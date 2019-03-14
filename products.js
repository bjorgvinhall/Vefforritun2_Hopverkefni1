const xss = require('xss');
const { query } = require('./db');

function isEmpty(s) {
  return s == null && !s;
}

async function listCategories(order, category = undefined) {
  let result;

  const orderString = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  if (category !== undefined) { // completed === 'false' || completed === 'true'
    // const completedAsBoolean = completed !== 'false';
    const q = `
    SELECT *
    FROM products
    WHERE category = $1
    ORDER BY date`;

    result = await query(q, [category]);
  } else {
    const q = `
    SELECT *
    FROM products
    ORDER BY date ${orderString}`;

    result = await query(q);
  }

  return result.rows;
}

// Sækir vöru eftir product id
async function getProductId(id) {
  const result = await query('SELECT * FROM products WHERE product_no = $1', [id]);

  // ef vara er ekki til þá skilum forum við inn í if lykkju
  if (result.rows.length === 0) {
    return {
      success: false,
      notFound: true,
      validation: [],
    };
  }

  // skila niðurstöðum
  return result.rows;
}

// sækir lista af flokkum
async function getCategories() {
  const result = await query('SELECT category FROM products ORDER BY category ASC');

  // ef vara er ekki til þá skilum forum við inn í if lykkju
  if (result.rows.length === 0) {
    return {
      success: false,
      notFound: true,
      validation: [],
    };
  }

  // skila niðurstöðum
  return result.rows;
}

module.exports = {
  listCategories,
  getProductId,
  getCategories,
};
