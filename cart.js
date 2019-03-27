/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable object-curly-newline */
const { query } = require('./db');

const { sanitizeXss } = require('./utils');

const { isEmpty } = require('./utils');

// Hjálparfall til að búa til nýja körfu ef notandi á ekki þegar körfu
async function createNewCart(username) {
  const user = await query('SELECT * FROM users WHERE username = $1', [username]);
  if (user.rows.length !== 1) {
    console.log('Notandi ekki til');
    return;
  }
  const userCart = await query('SELECT * FROM cart WHERE username = $1 AND isOrder = false', [username]);
  console.log(userCart);
  if (userCart.rows.length > 0) { // notandi á þegar körfu sem er ekki pöntun
    console.log('Notandi á þegar körfu');
    return;
  }
  await query('INSERT INTO cart (username) VALUES ($1)', [username]);
}

// get /cart
async function cartsList(req, res) {
  const { username } = req.user;
  // Finnum ID fyrir rétta körfu og sækjum hana
  const findID = await query('SELECT * FROM cart WHERE username = $1 AND isOrder = false', [username]);
  const { id } = findID.rows[0];
  const result = await query('SELECT * FROM cartItems WHERE cart_id = $1', [id]);
  let rowtotal = 0;
  let total = 0;
  let productInfo;
  for (let i=0; i<result.rows.length; i++){ // eslint-disable-line
    productInfo = await query('SELECT * FROM products WHERE title = $1', [result.rows[i].title]);
    rowtotal = result.rows[i].quantity * productInfo.rows[0].price;
    result.rows[i]['total'] = rowtotal;
    result.rows[i]['line number'] = i + 1;
    total += rowtotal;
    delete result.rows[i].username;
    delete result.rows[i].id;
  }
  const element = {};
  element['cart total'] = total;
  result.rows[result.rows.length] = element;
  return res.json(result.rows);
}

// post /cart
async function cartAdd(req, res) {
  const errors = [];
  const { isOrder = false, title, quantity } = req.body;
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
  return res.json(result.rows[0]);
}

// get /cart/line/:id
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

// delete /cart/line/:id
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

// patch /cart/line/:id
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

//  GET /orders
async function ordersList(req, res) {
  const { admin } = req.user;
  let result = {};
  if (admin) {
    // lista allar pantanir
    console.log("admin")
    const findOrders = await query('SELECT * FROM cart WHERE isOrder = true ORDER BY date DESC');
    for (let i = 0; i < findOrders.rows.length; i++) {
      const item = findOrders.rows[i];
      console.log(i, ":", item);
      const orderItems = await query('SELECT * FROM cartItems WHERE cart_id = $1', [item.id]);
      console.log("orderItems.rows i = ", i , ":", orderItems.rows);
      item['items in cart'] = orderItems.rows;
      result[`order ${i + 1}`] = item;
    }
  } else {
    // lista allar pantanir notanda
    console.log("ekki admin")
    const { username } = req.user;
    const findOrders = await query('SELECT * FROM cart WHERE isOrder = true AND username = $1 ORDER BY date DESC', [username]);
    for (let i = 0; i < findOrders.rows.length; i++) {
      const item = findOrders.rows[i];
      console.log(i, ":", item);
      const orderItems = await query('SELECT * FROM cartItems WHERE cart_id = $1', [item.id]);
      console.log("orderItems.rows i = ", i , ":", orderItems.rows);
      item['items in cart'] = orderItems.rows;
      result[`order ${i + 1}`] = item;
    }
  }

  if (result.length === 0) {
    return res.json({ orders: 'Engin pöntun til' });
  }
  return res.json(result);
}

// POST /orders
async function ordersPost(req, res) {
  const { username } = req.user;
  const { name, address } = req.body;
  const errors = [];
  // setjum name og address inn ef til staðar, annars error
  const cart = await query('SELECT * FROM cart WHERE username = $1', [username]);
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
  // if (karfa tóm) error
  // breyta körfu í order og búa til nýja körfu
  await query('UPDATE cart SET isOrder = true WHERE id = $1', [cart.rows[0].id]);
  const result = await query('UPDATE cart SET date = current_timestamp WHERE id = $1 RETURNING *', [cart.rows[0].id]);
  createNewCart(username);
  return res.json(result.rows[0]);
}

// GET /orders/:id
async function orderList(req, res) {
  const { id } = req.params;
  const result = await query('SELECT * FROM cartItems WHERE cart_id = $1', [id]);
  const item = result.rows[id - 1];
  if (isEmpty(item)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  return res.json(result.rows[0]);
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
