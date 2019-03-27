const xss = require('xss');
// const multer = require('multer');
const cloudinary = require('cloudinary');

const { query } = require('./db');

function isEmpty(s) {
  return s == null && !s;
}

/**
 * Staðfestir að inntak sé gilt.
 * isProdcut athugar hvort það sem verið er að validate'a sé vara, annars flokkur.
 *
 * @param {item} item Item til að staðfesta
 * @param {boolean} [isProduct=false]
 * @returns {array} Fylki af villum sem komu upp, tómt ef engin villa
 */
function validate({ title, price, text, imgurl, category } = {}, isProduct = false) {
  const errors = [];
  if (isProduct) {
    if (title === undefined
      || price === undefined
      || text === undefined
      || category === undefined) {
      errors.push({
        field: 'error',
        message: 'Ný vara verður að innihalda titil, verð, texta og flokk',
      });
    }
  }

  if (!isEmpty(title)) {
    if (typeof title !== 'string' || title.length < 1 || title.length > 128) {
      errors.push({
        field: 'title',
        message: 'Titill verður að vera strengur sem er 1 til 128 stafir',
      });
    }
  }

  if (!isEmpty(price)) {
    if (typeof price !== 'number' || Number(price) < 0) {
      errors.push({
        field: 'price',
        message: 'Verð verður að vera heiltala stærri eða jöfn 0',
      });
    }
  }

  if (!isEmpty(text)) {
    if (typeof text !== 'string' || text.length < 1 || text.length > 512) {
      errors.push({
        field: 'text',
        message: 'Texti verður að vera strengur sem er 1 til 512 stafir',
      });
    }
  }

  if (!isEmpty(imgurl)) {
    if (typeof imgurl !== 'string') {
      errors.push({
        field: 'imgurl',
        message: 'Slóð að mynd verður að vera strengur',
      });
    }
  }

  if (!isEmpty(category)) {
    if (typeof category !== 'string' || category.length < 1 || category.length > 128) {
      errors.push({
        field: 'category',
        message: 'Heiti á flokki verður að vera strengur sem er 1 til 128 stafir',
      });
    }
  }

  return errors;
}

/**
 * Route handler fyrir lista af products í gegnum GET.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {array} Fylki af vörum
 */
async function productsGet(req, res) {
  const { order = 'desc', category = '', search = '' } = req.query;
  let { offset = 0, limit = 10 } = req.query;
  offset = Number(offset);
  limit = Number(limit);

  let result;

  const orderString = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  if (search && category) {
    const q = `
    SELECT * FROM products
    WHERE category = $1
    AND
      to_tsvector('english', title) @@ plainto_tsquery('english', $2)
      OR
      to_tsvector('english', text) @@ plainto_tsquery('english', $2)
    ORDER BY date ${orderString}
    OFFSET $3 LIMIT $4`;

    result = await query(q, [category, search, offset, limit]);
  } else if (category) {
    const q = `
    SELECT *
    FROM products
    WHERE category = $1
    ORDER BY date ${orderString}
    OFFSET $2 LIMIT $3`;

    result = await query(q, [category, offset, limit]);
  } else if (search) {
    const q = `
    SELECT * FROM products
    WHERE
      to_tsvector('english', title) @@ plainto_tsquery('english', $1)
      OR
      to_tsvector('english', text) @@ plainto_tsquery('english', $1)
    ORDER BY date ${orderString}
    OFFSET $2 LIMIT $3`;

    result = await query(q, [search, offset, limit]);
  } else {
    const q = `
    SELECT *
    FROM products
    ORDER BY date ${orderString}
    OFFSET $1 LIMIT $2`;

    result = await query(q, [offset, limit]);
  }

  let results;

  if (category || search) {
    results = {
      limit: `${limit}`,
      offset: `${offset}`,
      items: result.rows,
    };
  } else {
    results = {
      limit: `${limit}`,
      offset: `${offset}`,
      items: result.rows,
      links: {
        self: {
          href: `/products/?offset=${offset}&limit=${limit}`,
        },
      },
    };

    if (offset > 0) {
      results.links.prev = {
        href: `/products/?offset=${offset - limit}&limit=${limit}`,
      };
    }

    if (result.rows.length <= limit) {
      results.links.next = {
        href: `/products/?offset=${Number(offset) + limit}&limit=${limit}`,
      };
    }
  }

  return res.json(results);
}

/**
 * Route handler fyrir staka vöru gegnum GET.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {array} Stök vara
 */
async function productsGetId(req, res) {
  const { id } = req.params;

  const q = 'SELECT * FROM products WHERE product_no = $1';

  let result = null;

  try {
    result = await query(q, [id]);
  } catch (e) {
    console.warn('Error fetching todo', e);
  }

  if (!result || result.rows.length === 0) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.json(result.rows[0]);
}

/**
 * Route handler til að búa til vöru gegnum POST.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Vara sem búin var til eða villur
 */
async function productsPost(req, res) {
  const {
    title,
    price,
    text,
    imgurl,
    category,
  } = req.body;

  // athuga hvort inntak sé leyfilegt
  const validation = validate(
    {
      title,
      price,
      text,
      imgurl,
      category,
    },
    true,
  );

  // ef ekki leyfilegt þá skila error
  if (validation.length > 0) {
    return res.status(400).json(validation);
  }

  // athuga hvort flokkur sé til
  const q1 = 'SELECT * FROM categories WHERE category = $1';
  const checkCategoryName = await query(q1, [category]);

  // ef flokkur ekki til þá skila error
  if (checkCategoryName.rows.length === 0) {
    return res.status(400).json({ error: 'Flokkur er ekki til' });
  }

  // athuga hvort vara sé til
  const q2 = 'SELECT * FROM products WHERE title = $1';
  const checkProductName = await query(q2, [title]);

  // ef vara er til þá skila error
  if (checkProductName.rows.length > 0) {
    return res.status(400).json({ error: 'Vara er nú þegar til' });
  }

  const columns = [
    'title',
    'price',
    'text',
    imgurl ? 'imgurl' : null,
    'category',
  ].filter(Boolean);

  const values = [
    xss(title),
    xss(price),
    xss(text),
    imgurl ? xss(imgurl) : null,
    xss(category),
  ].filter(Boolean);

  const params = values.map((_, i) => `$${i + 1}`);

  const sqlQuery = `
    INSERT INTO products (${columns.join(',')})
    VALUES (${params})
    RETURNING *`;

  const result = await query(sqlQuery, values);

  return res.status(201).json(result.rows[0]);
}

/**
 * Route handler til að breyta vöru gegnum PATCH.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Breytt vara eða villa
 */
async function productsPatch(req, res) {
  const { id } = req.params;
  const {
    title,
    price,
    text,
    imgurl,
    category,
  } = req.body;

  // athuga hvort flokkur sé til
  if (category) {
    const q1 = 'SELECT * FROM categories WHERE category = $1';
    const checkCategoryName = await query(q1, [category]);

    // ef flokkur ekki til þá skila error
    if (checkCategoryName.rows.length === 0) {
      return res.status(400).json({ error: 'Flokkur er ekki til' });
    }
  }

  // athuga hvort vara sé til
  const q2 = 'SELECT * FROM products WHERE title = $1';
  const checkProductName = await query(q2, [title]);

  // ef vara er til þá skila error
  if (checkProductName.rows.length > 0) {
    return res.status(400).json({ error: 'Vara er nú þegar til' });
  }

  // athuga hvort inntak sé leyfilegt
  const validation = validate({
    title,
    price,
    text,
    imgurl,
    category,
  });

  // ef ekki leyfilegt þá skila error
  if (validation.length > 0) {
    return res.status(400).json(validation);
  }

  const filteredValues = [
    xss(title),
    xss(price),
    xss(text),
    imgurl ? xss(imgurl) : null,
    xss(category),
  ]
    .filter(Boolean);

  const updates = [
    title ? 'title' : null,
    price ? 'price' : null,
    text ? 'text' : null,
    imgurl ? 'imgurl' : null,
    category ? 'category' : null,
  ]
    .filter(Boolean)
    .map((field, i) => `${field} = $${i + 2}`);

  const sqlQuery = `
  UPDATE products
  SET ${updates} WHERE product_no = $1
  RETURNING *`;
  const values = [id, ...filteredValues];

  const result = await query(sqlQuery, values);

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.status(201).json(result.rows[0]);
}

/**
 * Route handler til að eyða vöru gegnum DELETE.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Engu ef eytt, annars villu
 */
async function productsDelete(req, res) {
  const { id } = req.params;

  const q = 'DELETE FROM products WHERE product_no = $1';
  const result = await query(q, [id]);

  if (result.rowCount === 1) {
    return res.status(204).json({});
  }

  return res.status(404).json({ error: 'Item not found' });
}

/**
 * Route handler fyrir lista af flokkum í gegnum GET.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {array} Fylki af flokkum
 */
async function categoriesGet(req, res) {
  let { offset = 0, limit = 10 } = req.query;
  offset = Number(offset);
  limit = Number(limit);

  const q = 'SELECT * FROM categories ORDER BY id OFFSET $1 LIMIT $2';
  const result = await query(q, [offset, limit]);

  const results = {
    limit: `${limit}`,
    offset: `${offset}`,
    items: result.rows,
    links: {
      self: {
        href: `/categories/?offset=${offset}&limit=${limit}`,
      },
    },
  };

  if (offset > 0) {
    results.links.prev = {
      href: `/categories/?offset=${offset - limit}&limit=${limit}`,
    };
  }

  if (result.rows.length <= limit) {
    results.links.next = {
      href: `/categories/?offset=${Number(offset) + limit}&limit=${limit}`,
    };
  }

  return res.json(results);
}

/**
 * Route handler fyrir stakan flokk gegnum GET.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {array} Stakur flokkur
 */
async function categoriesGetId(req, res) {
  const { id } = req.params;

  const q = 'SELECT * FROM categories WHERE id = $1';
  let result = null;

  try {
    result = await query(q, [id]);
  } catch (e) {
    console.warn('Error fetching todo', e);
  }

  if (!result || result.rows.length === 0) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.json(result.rows[0]);
}

/**
 * Route handler til að búa til flokk gegnum POST.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Flokkur sem búin var til eða villur
 */
async function categoriesPost(req, res) {
  const { category } = req.body;

  if (category === undefined) {
    const errors = [];
    errors.push({
      field: 'category',
      message: 'Heiti á flokki verður að vera strengur sem er 1 til 128 stafir',
    });

    return res.status(400).json(errors);
  }

  // athuga hvort inntak sé leyfilegt
  const validation = validate({ category });

  // ef ekki leyfilegt þá skila error
  if (validation.length > 0) {
    return res.status(400).json(validation);
  }

  // athuga hvort flokkur sé til
  const q = 'SELECT * FROM categories WHERE category = $1';
  const check = await query(q, [category]);

  // ef flokkur er til þá skila error
  if (check.rows.length > 0) {
    return res.status(400).json({ error: 'Flokkur er nú þegar til' });
  }

  const columns = [
    'category',
  ].filter(Boolean);

  const values = [
    xss(category),
  ].filter(Boolean);

  const params = values.map((_, i) => `$${i + 1}`);

  const sqlQuery = `
    INSERT INTO categories (${columns.join(',')})
    VALUES (${params})
    RETURNING *`;

  const result = await query(sqlQuery, values);

  return res.status(201).json(result.rows[0]);
}

/**
 * Route handler til að breyta flokki gegnum PATCH.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Breyttur flokkur eða villa
 */
async function categoriesPatch(req, res) {
  const { id } = req.params;
  const { category } = req.body;

  // const result = await updateCategory(id, item);

  const validation = validate({ category }, false);

  if (validation.length > 0) {
    return res.status(400).json(validation);
  }

  // athuga hvort flokkur sé til
  const q = 'SELECT * FROM categories WHERE category = $1';
  const check = await query(q, [category]);

  // ef flokkur er til þá skila error
  if (check.rows.length > 0) {
    return res.status(400).json({ error: 'Flokkur er nú þegar til' });
  }

  const filteredValues = [
    xss(category),
  ]
    .filter(Boolean);

  const updates = [
    'category',
  ]
    .filter(Boolean)
    .map((field, i) => `${field} = $${i + 2}`);

  const sqlQuery = `
  UPDATE categories
  SET ${updates} WHERE id = $1
  RETURNING *`;
  const values = [id, ...filteredValues];

  let result;
  const errors = [];

  try {
    result = await query(sqlQuery, values);
  } catch (e) {
    errors.push({
      field: 'error',
      message: 'Flokkur inniheldur vörur. Vinsamlegast eyðið öllum vörum úr flokki áður en flokki er breytt',
    });

    return res.status(400).json(errors);
  }

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Item not found' });
  }

  return res.status(201).json(result.rows[0]);
}

/**
 * Route handler til að eyða flokki gegnum DELETE.
 *
 * @param {object} req Request hlutur
 * @param {object} res Response hlutur
 * @returns {object} Engu ef eytt, annars villu
 */
async function categoriesDelete(req, res) {
  const { id } = req.params;

  let result;
  const errors = [];

  const q = 'DELETE FROM categories WHERE id = $1';

  try {
    result = await query(q, [id]);
  } catch (e) {
    errors.push({
      field: 'error',
      message: 'Flokkur inniheldur vörur. Vinsamlegast eyðið öllum vörum úr flokki áður en flokki er eytt',
    });

    return res.status(400).json(errors);
  }

  if (result.rowCount === 1) {
    return res.status(204).json({});
  }

  return res.status(404).json({ error: 'Item not found' });
}

module.exports = {
  productsGet,
  productsGetId,
  productsPost,
  productsImagePost,
  productsPatch,
  productsDelete,
  categoriesGet,
  categoriesGetId,
  categoriesPost,
  categoriesPatch,
  categoriesDelete,
};
