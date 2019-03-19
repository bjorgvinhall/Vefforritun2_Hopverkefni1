const { query } = require('./db');

const { sanitizeXss } = require('./utils');

const { isEmpty } = require('./utils');

async function cartsList(req, res) {
  // const { completed, order } = req.query;
  const username = 'admin'; // req.user.name;

  const result = await query('SELECT * FROM cartItems WHERE username = $1', [username]);

  return res.json(result.rows);
}

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

  const username = 'admin'; // req.user.name;

  if (errors.length > 0) {
    return res.status(400).json(errors);
  }
  // Setjum inn í gagnagrunn
  q = `INSERT INTO cartItems (username, title, quantity)
  VALUES ($1 ,$2, $3) RETURNING username, title, quantity`;
  const result = await query(q, [username, title, quantity]);
  return res.json(result.rows);
}

module.exports = {
  cartsList,
  cartAdd,
  // cartList,
  // cartPatch,
  // cartDelete,
};
