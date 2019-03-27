/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable object-curly-newline */
const { query } = require('./db');

const { sanitizeXss } = require('./utils');

const { isEmpty } = require('./utils');

/**
 * Hjálparfall til að búa til nýja körfu, ef notandi á ekki körfu
 * @param {string} username notandanafn notanda
 */
async function createNewCart(username) {
  const user = await query('SELECT * FROM users WHERE username = $1', [username]);
  if (user.rows.length !== 1) {
    console.error('Notandi ekki til');
    return;
  }
  const userCart = await query('SELECT * FROM cart WHERE username = $1 AND isOrder = false', [username]);
  if (userCart.rows.length > 0) { // notandi á þegar körfu sem er ekki pöntun
    console.error('Notandi á þegar körfu');
    return;
  }
  const userOrder = await query('SELECT * FROM cart WHERE username = $1 AND isOrder = true', [username]);
  if (userOrder.rows.length !== 0) {
    const { name = '', address = '' } = userOrder.rows[0];
    await query('INSERT INTO cart (username, name, address) VALUES ($1, $2, $3)', [username, name, address]);
  } else {
    await query('INSERT INTO cart (username) VALUES ($1)', [username]);
  }
}

/**
 * Fall sem skilar körfu fyrir notanda
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * @returns {array} Fylki af hlutum í körfu
 * get /cart
 */
async function cartsList(req, res) {
  const { username } = req.user;

  let { offset = 0, limit = 10 } = req.query;
  offset = Number(offset);
  limit = Number(limit);

  // Finnum ID fyrir rétta körfu og sækjum hana
  const findID = await query('SELECT * FROM cart WHERE username = $1 AND isOrder = false', [username]);
  const { id } = findID.rows[0];
  const q = 'SELECT * FROM cartItems WHERE cart_id = $1 OFFSET $2 LIMIT $3';
  const result = await query(q, [id, offset, limit]);

  let rowtotal = 0;
  let total = 0;
  let productInfo;

  for (let i=0; i<result.rows.length; i++){ // eslint-disable-line
    productInfo = await query('SELECT * FROM products WHERE title = $1', [result.rows[i].title]);
    rowtotal = result.rows[i].quantity * productInfo.rows[0].price;
    result.rows[i].total = rowtotal;
    result.rows[i]['line number'] = i + 1;
    total += rowtotal;
    delete result.rows[i].username;
    delete result.rows[i].id;
  }
  const element = {};
  element['cart total'] = total;
  result.rows[result.rows.length] = element;

  const results = {
    limit: `${limit}`,
    offset: `${offset}`,
    items: result.rows,
    links: {
      self: {
        href: `/cart/?offset=${offset}&limit=${limit}`,
      },
    },
  };

  if (offset > 0) {
    results.links.prev = {
      href: `/cart/?offset=${offset - limit}&limit=${limit}`,
    };
  }

  if (result.rows.length - 1 <= limit) {
    results.links.next = {
      href: `/cart/?offset=${Number(offset) + limit}&limit=${limit}`,
    };
  }

  return res.json(results);
}

/**
 * Fall sem bætir vöru við í körfu notanda
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * @returns {Result} Niðurstaða þess að búa til notanda
 * post /cart
 */
async function cartAdd(req, res) {
  const errors = [];
  const { title, quantity } = req.body;
  // athuga hvort flokkur sé til
  let q = `SELECT * FROM products WHERE title = '${title}'`;
  const check = await query(q);

  if (typeof title !== 'string' || title.length < 1 || title.length > 128) {
    errors.push({
      field: 'title',
      message: 'Titill verður að vera strengur sem er 1-128 stafir',
    });
  } else if (check.rows.length === 0) {
    errors.push({
      field: 'title',
      message: 'Vara er ekki til í vefbúð',
    });
  } else sanitizeXss('title');
  if (typeof quantity !== 'number' || quantity <= 0) {
    errors.push({
      field: 'quantity',
      message: 'quantity verður að vera heiltala stærri en 0',
    });
  } else sanitizeXss('quantity');

  const { username } = req.user;
  const findID = await query('SELECT * FROM cart WHERE username = $1 AND isOrder = false', [username]);
  const { id } = findID.rows[0];
  if (errors.length > 0) {
    return res.status(400).json(errors);
  }
  // Setjum inn í gagnagrunn
  q = `INSERT INTO cartItems (cart_id, username, title, quantity)
  VALUES ($1 ,$2, $3, $4) RETURNING title, quantity`;
  const result = await query(q, [id, username, title, quantity]);
  return res.status(201).json(result.rows[0]);
}

/**
 * Fall sem skilar línu í körfu með fjölda og upplýsingum um vöru
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * get /cart/line/:id
 */
async function cartList(req, res) {
  const { id } = req.params;
  const { username } = req.user;
  const result = await query('SELECT * FROM cartItems WHERE username = $1', [username]);
  const item = result.rows[id - 1];
  if (isEmpty(item)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const info = await query('SELECT * FROM products WHERE title = $1', [item.title]);
  delete info.rows[0].username; // þurfum ekki að birta username
  info.rows[0].quantity = result.rows[id - 1].quantity;
  return res.json(info.rows[0]);
}

/**
 * Fall sem eyðir línu úr körfu sem notandi á
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * delete /cart/line/:id
 */
async function cartDelete(req, res) {
  const { id } = req.params;
  const { username } = req.user;

  const data = await query('select * from cartItems WHERE username = $1', [username]);
  const item = data.rows[id - 1];
  if (isEmpty(item)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  // Ef við komumst hingað þá er hlutur til
  await query('DELETE FROM cartItems WHERE id = $1 AND username = $2', [data.rows[id - 1].id, username]);
  return res.status(204).json(item);
}

/**
 * Fall sem uppfærir fjölda í línu, í körfu sem notandi á
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * patch /cart/line/:id
 */
async function cartPatch(req, res) {
  const { id } = req.params;
  const { username } = req.user;
  const { quantity } = req.body;
  // Byrjum á að sjá hvort :id sé gilt
  const data = await query('SELECT * FROM cartItems WHERE username = $1', [username]);
  const item = data.rows[id - 1];
  if (isEmpty(item)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  // Vitum að hlutur er til
  if (isEmpty(quantity)) return res.status(400).json({ quantity: 'patch verður að innihalda fjölda' });
  if (!isEmpty(quantity) && typeof quantity === 'number' && quantity > 0) {
    const result = await query('UPDATE cartItems SET quantity = $1 WHERE id = $2 AND username = $3 RETURNING *', [quantity, data.rows[id - 1].id, username]);
    return res.json(result.rows[0]);
  }
  return res.status(400).json({ quantity: 'quantity verður að vera heiltala stærri en 0' });
}

/**
 * Fall sem skilar síðu af pöntunum,
 * Ef notandi er ekki stjórnandi: pantanir þess notanda
 * Ef notandi er stjórnandi: allar pantanir
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * get /orders
 */
async function ordersList(req, res) {
  const { admin } = req.user;
  let { offset = 0, limit = 10 } = req.query;
  offset = Number(offset);
  limit = Number(limit);

  const result = {};
  let q = '';
  if (admin) {
    // lista allar pantanir
    q = 'SELECT * FROM cart WHERE isOrder = true ORDER BY date DESC OFFSET $1 LIMIT $2';
    const findOrders = await query(q, [offset, limit]);
    for (let i = 0; i < findOrders.rows.length; i++) {
      const item = findOrders.rows[i];
      const orderItems = await query('SELECT * FROM cartItems WHERE cart_id = $1', [item.id]);
      item['items in cart'] = orderItems.rows;
      result[`order ${i + 1}`] = item;
    }
  } else {
    // lista allar pantanir notanda
    const { username } = req.user;
    q = 'SELECT * FROM cart WHERE isOrder = true AND username = $1 ORDER BY date DESC OFFSET $2 LIMIT $3';
    const findOrders = await query(q, [username, offset, limit]);
    for (let i = 0; i < findOrders.rows.length; i++) {
      const item = findOrders.rows[i];
      const orderItems = await query('SELECT * FROM cartItems WHERE cart_id = $1', [item.id]);
      item['items in cart'] = orderItems.rows;
      result[`order ${i + 1}`] = item;
    }
  }

  if (result.length === 0 || typeof result['order 1'] === 'undefined') {
    return res.json({ orders: 'Engin pöntun til' });
  }

  const results = {
    limit: `${limit}`,
    offset: `${offset}`,
    items: result,
    links: {
      self: {
        href: `/orders/?offset=${offset}&limit=${limit}`,
      },
    },
  };

  if (offset > 0) {
    results.links.prev = {
      href: `/orders/?offset=${offset - limit}&limit=${limit}`,
    };
  }

  if (result.length <= limit) {
    results.links.next = {
      href: `/orders/?offset=${Number(offset) + limit}&limit=${limit}`,
    };
  }

  return res.json(results);
}

/**
 * Fall sem býr til pöntun úr körfu með viðeigandi gildum
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * post /orders
 */
async function ordersPost(req, res) {
  const { username } = req.user;
  const { name, address } = req.body;
  const cart = await query('SELECT * FROM cart WHERE username = $1 AND isorder = false', [username]);
  const { id } = cart.rows[0];
  const cartItmes = await query('SELECT * FROM cartItems WHERE cart_id = $1', [id]);
  if (cartItmes.rows.length === 0) return res.status(400).json({ error: 'Karfa er tóm' });
  const errors = [];
  // setjum name og address inn ef til staðar, annars error
  if (isEmpty(cart.rows[0].name)) { // ef ekkert nafn í gagnagrunni
    if (isEmpty(name)) {
      errors.push({
        field: 'name',
        message: 'Nafn vantar',
      });
    } else if (typeof name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Nafn verður að vera strengur',
      });
    } else {
      sanitizeXss('name');
      await query('UPDATE cart SET name = $1 WHERE username = $2', [name, username]);
    }
  }
  if (isEmpty(cart.rows[0].address)) { // ef ekkert heimilisfang í gagnagrunni
    if (isEmpty(address)) {
      errors.push({
        field: 'address',
        message: 'Heimilisfang vantar',
      });
    } else if (typeof address !== 'string') {
      errors.push({
        field: 'address',
        message: 'Heimilisfang verður að vera strengur',
      });
    } else {
      sanitizeXss('address');
      await query('UPDATE cart SET address = $1 WHERE username = $2', [address, username]);
    }
  }
  if (errors.length > 0) {
    return res.status(400).json(errors);
  }

  // breyta körfu í order og búa til nýja körfu
  await query('UPDATE cart SET isOrder = true WHERE id = $1', [cart.rows[0].id]);
  const result = await query('UPDATE cart SET date = current_timestamp WHERE id = $1 RETURNING *', [cart.rows[0].id]);
  createNewCart(username);
  return res.json(result.rows[0]);
}

/**
 * Fall sem skilar tiltekinni pöntun ef notandi á pöntun/er stjórnandi
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * get /orders/:id
 */
async function orderList(req, res) {
  const { username, admin } = req.user;
  const { id } = req.params;
  let result = {};
  // sækjum körfu með :id
  const findOrders = await query('SELECT * FROM cart WHERE isOrder = true AND id = $1', [id]);
  const cart = findOrders.rows[0];
  if (!admin && username !== cart.username) {
    return res.status(401).json({ orders: 'Þú hefur ekki aðgang að þessari körfu' });
  }
  const item = findOrders.rows[0];
  if (typeof item === 'undefined') {
    return res.status(404).json({ orders: 'Pöntun ekki til' });
  }
  const orderItems = await query('SELECT * FROM cartItems WHERE cart_id = $1', [item.id]);
  item['items in cart'] = orderItems.rows;
  result = item;

  return res.json(result);
}

module.exports = {
  createNewCart,
  cartsList,
  cartAdd,
  cartList,
  cartPatch,
  cartDelete,
  ordersList,
  ordersPost,
  orderList,
};
