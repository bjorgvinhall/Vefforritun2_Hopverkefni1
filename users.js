/* eslint-disable object-curly-newline */
const xss = require('xss');
const validator = require('validator');
const bcrypt = require('bcrypt');
const fs = require('fs');
const { query } = require('./db');
const { createNewCart } = require('./cart');

/**
 * @typedef {object} User
 * @property {string} username Notandanafn notanda
 * @property {string} password Lykilorð notanda
 * @property {string} email Netfang notanda
 */

/**
 * @typedef {object} Result
 * @property {boolean} success Hvort aðgerð hafi tekist
 * @property {boolean} notFound Hvort hlutur hafi fundist
 * @property {array} validation Fykli af villum, ef einhverjar
 * @property {User} user Notandi
 */

/**
 * Fall sem finnur notanda eftir netfangi
 * @param {string} email netfang notanda
 * @returns {User} notanda
 */
async function findByEmail(email) {
  const q = 'SELECT * FROM users WHERE email = $1';

  const result = await query(q, [email]);
  if (result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

/**
 * Fall sem finnur notanda eftir auðkenni
 * @param {number} id auðkenni notanda
 * @returns {User} notanda
 */
async function findById(id) {
  const q = 'SELECT * FROM users WHERE id = $1';

  const result = await query(q, [id]);

  if (result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

/**
 * Fall sem finnur notanda eftir netfangi
 * @param {string} email netfang notanda
 * @returns {User} notanda
 */
async function findByUsername(username) {
  const q = 'SELECT * FROM users WHERE username = $1';

  const result = await query(q, [username]);
  if (result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

/**
 * Athugar hvort username og password sé til í notandakerfi.
 * Callback tekur við villu sem fyrsta argument, annað argument er
 * - `false` ef notandi ekki til eða lykilorð vitlaust
 * - Notandahlutur ef rétt
 *
 * @param {string} username Notandanafn til að athuga
 * @param {string} password Lykilorð til að athuga
 * @param {function} done Fall sem kallað er í með niðurstöðu
 */
async function userStrategy(username, password, done) {
  try {
    const user = await findByUsername(username);

    if (!user) {
      return done(null, false);
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);

    if (passwordsMatch) {
      return done(null, user);
    }
  } catch (err) {
    console.error(err);
    return done(err);
  }

  return done(null, false);
}

/**
 * Athugar hvort strengur sé "tómur", þ.e.a.s. `null`, `undefined`.
 *
 * @param {string} s Strengur til að athuga
 * @returns {boolean} `true` ef `s` er "tómt", annars `false`
 */
function isEmpty(s) {
  return s == null && !s;
}

/**
 * Staðfestir að todo item sé gilt. Ef verið er að breyta item sem nú þegar er
 * til, þá er `patching` sent inn sem `true`.
 *
 * @param {User} user Notandi til að staðfesta
 * @param {boolean} [patching=false]
 * @returns {array} Fylki af villum sem komu upp, tómt ef engin villa
 */
function validate({ username, password, email, name, address } = {}, patching = false) {
  const errors = [];

  if (!patching || !isEmpty(username)) {
    if (typeof username !== 'string' || username.length < 1) {
      errors.push({
        field: 'username',
        message: 'Notandanafn krafist',
      });
    }
  } else xss('username');

  if (!patching || !isEmpty(password)) {
    if (password.length < 8) {
      errors.push({
        field: 'password',
        message: 'Lykilorð verður að vera amk. 8 stafir',
      });
    }
  } else xss('password');

  if (!patching || !isEmpty(email)) {
    if (typeof email !== 'string' || email.length < 1 || !validator.isEmail(email)) {
      errors.push({
        field: 'email',
        message: 'Netfang verður að vera á formi netfangs',
      });
    }
  } else xss('email');

  if (!isEmpty(name)) {
    if (typeof name !== 'string' || name.length < 1) {
      errors.push({
        field: 'name',
        message: 'Nafn verður að vera strengur',
      });
    }
  } else xss('name');

  if (!isEmpty(address)) {
    if (typeof address !== 'string' || address.length < 1) {
      errors.push({
        field: 'address',
        message: 'Heimilisfang verður að vera strengur',
      });
    }
  } else xss('address');

  return errors;
}

/**
 * Skilar lista af notendum gegnum GET
 * @param {*} req  Request hlutur
 * @param {*} res Response hlutur
 * @returns {array} Fylki af notendum
 * get /users/
 */
async function usersGet(req, res) {
  const q = `
  SELECT * FROM users`;

  const result = await query(q);
  const users = result.rows;
  for (let i = 0; i < users.length; i += 1) {
    delete users[i].password;
  }
  return res.json(users);
}

/**
 * Sækir stakan notanda eftir auðkenni
 * @param {number} id Auðkenni notanda
 * @returns {object} User ef hann er til, annars null
 * get /users/:id
 */
async function usersGetId(id) {
  const q = `
  SELECT * FROM users
  WHERE id = $1`;
  let result = null;

  try {
    result = await query(q, [id]);
  } catch (e) {
    console.warn('Error fetching user', e);
  }

  if (!result || result.rows.length === 0) {
    return null;
  }
  delete result.rows[0].password;
  return result.rows[0];
}

/**
 * Uppfærir stjórnandastöðu notanda
 * @param {number} id Auðkenni notanda
 * @param {boolean} admin Gildi sem segir til um hvort notandi sé stjórnandi
 * @returns {Result} Niðurstaða þess að búa til notandann
 * patch /users/:id
 */
async function usersPatchId(id, admin) {
  const updates = [
    admin != null ? 'admin' : null,
  ]
    .filter(Boolean)
    .map((field, i) => `${field} = $${i + 2}`);

  const q = `
    UPDATE users
    SET ${updates} WHERE id = $1
    RETURNING id, username, password, email, admin`;
  const values = [id, admin];

  const result = await query(q, values);
  delete result.rows[0].password;
  if (result.rowCount === 0) {
    return {
      success: false,
      validation: [],
      notFound: true,
      item: null,
    };
  }

  return {
    success: true,
    validation: [],
    notFound: false,
    item: result.rows[0],
  };
}

/**
 * Fall sem ber saman lykilorð við 500 verstu lykilorð heims
 * @param {string} password lykilorð
 * @returns {Boolean} true ef lykilorðið tilheyrir þeim, annars false
 */
function worstPasswords(password) {
  const byLine = fs.readFileSync('worstpw.txt').toString().split('\n');
  const worst = byLine.map(x => x.trim());
  for (let i = 0; i < worst.length; i += 1) {
    if (password === worst[i]) {
      return true;
    }
  }
  return false;
}

/**
 * Býr til nýjan notanda
 *
 * @param {Request} req hlutur
 * @param {Response} res hlutur
 * @returns {Result} Niðurstaða þess að búa til notanda
 * post /users/register
 */
async function usersRegister(req, res) {
  const { username, password, email, name, address } = req.body;
  const errors = validate({ username, password, email, name, address }, false);
  if (errors.length > 0) {
    return res.status(400).json(errors);
  }
  // athuga hvort notandi sé nú þegar til
  const q1 = 'SELECT * FROM users WHERE username = $1';
  const q2 = 'SELECT * FROM users WHERE email = $1';
  const usercheck = await query(q1, [username]);
  const emailcheck = await query(q2, [email]);

  // ef notendanafn eða email er til þá skila error
  if (usercheck.rows.length > 0) {
    return res.status(400).json({ error: 'notandi nú þegar til' });
  }
  if (emailcheck.rows.length > 0) {
    return res.status(400).json({ error: 'netfang nú þegar skráð' });
  }

  // athuga hvort að lykilorð sé of veikt
  if (worstPasswords(password)) {
    return res.status(400).json({ error: 'Lykilorð er of veikt' });
  }

  // ef við komumst hingað búum við til notanda
  const hashedPassword = await bcrypt.hash(password, 11);

  const q = `
  INSERT INTO
  users (username, password, email)
  VALUES ($1, $2, $3) RETURNING *`;

  const result = await query(q, [username, hashedPassword, email]);

  result.rows[0].password = password; // birtum upphaflega pw í stað hashaða pw

  // Býr til körfu fyrir notanda
  await createNewCart(username);
  // setjum inn nafn og heimilisfang ef það var gefið upp
  if (!isEmpty(name)) {
    await query('UPDATE cart SET name = $1 WHERE username = $2', [name, username]);
    result.rows[0].name = name;
  }
  if (!isEmpty(address)) {
    await query('UPDATE cart SET address = $1 WHERE username = $2', [address, username]);
    result.rows[0].address = address;
  }

  return res.status(201).json(result.rows[0]);
}

/**
 * Sækir upplýsingar um notanda sem er innskráður
 * @param {number} id Auðkenni notanda
 * @returns {object} User
 * get /users/me
 */
async function usersGetMe(id) {
  const q = `
  SELECT * FROM users
  WHERE id = $1`;
  let result = null;

  try {
    result = await query(q, [id]);
  } catch (e) {
    console.warn('Error fetching user', e);
  }

  if (!result || result.rows.length === 0) {
    return null;
  }
  delete result.rows[0].password;
  return result.rows[0];
}

/**
 * Uppfærir upplýsingar um innskráðan notanda
 * @param {number} id Auðkenni notanda
 * @param {User} user Notanda hlutur með gildum sem á að uppfæra
 * @returns {Result} Niðurstaða þess að breyta notanda
 * patch /users/me
 */
async function usersPatchMe(id, { password, email }) {
  const validation = validate({ password, email }, true);

  if (validation.length > 0) {
    return {
      success: false,
      validation,
    };
  }

  const filteredValues = [
    xss(password),
    xss(email),
  ];

  const updates = [
    password ? 'password' : null,
    email ? 'email' : null,
  ]
    .filter(Boolean)
    .map((field, i) => `${field} = $${i + 2}`);
  const q = `
    UPDATE users
    SET ${updates} WHERE id = $1
    RETURNING id, username, password, email, admin`;
  const values = [id, ...filteredValues];

  const result = await query(q, values);
  delete result.rows[0].password;

  if (result.rowCount === 0) {
    return {
      success: false,
      validation: [],
      notFound: true,
      item: null,
    };
  }

  return {
    success: true,
    validation: [],
    notFound: false,
    item: result.rows[0],
  };
}

/**
 * Ber saman innslegið lykilorð við lykilorðið aðgangs
 * @param {string} hash lykilorð aðgangs
 * @param {string} password innslegið lykilorð
 * @returns {Result} Niðurstaða samanborningar
 */
async function comparePasswords(hash, password) {
  const result = await bcrypt.compare(hash, password);

  return result;
}

module.exports = {
  findByEmail, // til að login virki
  findById,
  userStrategy,
  usersGet,
  usersGetId,
  usersPatchId,
  usersRegister,
  usersGetMe,
  usersPatchMe,
  comparePasswords,
};
