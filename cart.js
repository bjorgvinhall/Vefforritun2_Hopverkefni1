/* eslint-disable object-curly-newline */
const { query } = require('./db');

const { sanitizeXss } = require('./utils');

const { isEmpty } = require('./utils');

// get /cart
async function cartsList(req, res) {
  // const { completed, order } = req.query;
  const { username } = req.user;
  const result = await query('SELECT * FROM cartItems WHERE username = $1', [username]);
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

  if (errors.length > 0) {
    return res.status(400).json(errors);
  }
  // Setjum inn í gagnagrunn
  q = `INSERT INTO cartItems (username, title, quantity)
  VALUES ($1 ,$2, $3) RETURNING title, quantity`;
  const result = await query(q, [username, title, quantity]);
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

module.exports = {
  cartsList,
  cartAdd,
  cartList,
  cartPatch,
  cartDelete,
};
