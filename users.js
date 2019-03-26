const xss = require('xss');
const bcrypt = require('bcrypt');
const { query } = require('./db');

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

async function findByUsername(username) {
  const q = 'SELECT * FROM users WHERE username = $1';

  const result = await query(q, [username]);

  if (result.rowCount === 1) {
    return result.rows[0];
  }

  return null;
}

async function findById(id) {
  const q = 'SELECT * FROM users WHERE id = $1';

  const result = await query(q, [id]);

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
function validate({ username, password, email } = {}, patching = false) {
  const errors = [];

  if (!patching || !isEmpty(username)) {
    if (typeof username !== 'string' || username.length < 1) {
      errors.push({
        field: 'username',
        message: 'Notandanafn krafist',
      });
    }
  }

  if (!patching || !isEmpty(password)) {
    if (password.length < 8) {
      errors.push({
        field: 'password',
        message: 'Lykilorð verður að vera amk. 8 stafir',
      });
    }
  }

  if (!patching || !isEmpty(email)) {
    if (typeof email !== 'string' || email.length < 1) {
      errors.push({
        field: 'email',
        message: 'Netfang verður að vera á formi netfangs',
      });
    }
  }

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
  return res.json(result.rows);
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

    /* Til að fá út objectinn, deleta fyrir skil, ekki að nota þetta atm
    for (key in result) {
      var value = result[key];
      console.log(value);
    } */
  } catch (e) {
    console.warn('Error fetching user', e);
  }

  if (!result || result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Uppfærir stjórnandastöðu notanda
 * @param {number} id Auðkenni notanda
 * @param {boolean} admin Gildi sem segir til um hvort notandi sé stjórnandi
 * @returns {Result} Niðurstaða þess að búa til notandann
 * patch /users/admin/:id
 */
async function usersPatchId(id, admin) {
  const updates = [ // admin = $2
    admin != null ? 'admin' : null,
  ]
    .filter(Boolean)
    .map((field, i) => `${field} = $${i + 2}`);;

  const q = `
    UPDATE users
    SET ${updates} WHERE id = $1
    RETURNING id, username, password, email, admin`;
  const values = [id, admin];

  const result = await query(q, values);

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
 * Býr til nýjan notanda
 *
 * @param {User} user Notandi til að búa til
 * @returns {Result} Niðurstaða þess að búa til notanda
 */
async function usersRegister(req, res) {
  const { username, password, email } = req.body;
  const errors = validate({ username, password, email }, false);
  if (errors.length > 0) {
    return res.status(400).json(errors);
  }
  // athuga hvort notandi sé nú þegar til
  const q1 = 'SELECT * FROM users WHERE username = $1';
  const usercheck = await query(q1, [username]);

  // ef notandi er til þá skila error
  if (usercheck.rows.length > 0) {
    return res.status(400).json({ error: 'notandi nú þegar til' });
  }
  // ef við komumst hingað búum við til notanda
  const hashedPassword = await bcrypt.hash(password, 11);

  const q = `
  INSERT INTO
  users (username, password, email)
  VALUES ($1, $2, $3) RETURNING username, password, email`;

  const result = await query(q, [username, hashedPassword, email]);
  return res.status(201).json(result.rows[0]);
}

/**
 * Uppfærir upplýsingar um notanda
 * @param {number} id Auðkenni notanda
 * @param {User} user Notanda hlutur með gildum sem á að uppfæra
 * @returns {Result} Niðurstaða þess að búa til notandann
 * patch /users/:id
 * *******************************************************************
 * ÞETTA ÞARF EKKI EN NOTUM ÞETTA TIL AÐ GERA Á USERS/ME
 * *******************************************************************
 */

async function usersPatch(id, { username, password, email }) {
  const validation = validate({ username, password, email }, true);

  if (validation.length > 0) {
    return {
      success: false,
      validation,
    };
  }

  const filteredValues = [
    xss(username),
    xss(password),
    xss(email),
  ];

  const updates = [
    username ? 'username' : null,
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

  return result.rows[0];
}

/**
 * 
 * @param {*} id 
 * @param {*} param1 
 */
async function usersPatchMe(id, { username, password, email }) {
  const validation = validate({ username, password, email }, true);

  if (validation.length > 0) {
    return {
      success: false,
      validation,
    };
  }

  const filteredValues = [
    xss(username),
    xss(password),
    xss(email),
  ];

  const updates = [
    username ? 'username' : null,
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
  findByUsername, // til að login virki
  findById,
  userStrategy,
  usersGet,
  usersGetId,
  usersPatchId,
  usersRegister,
  usersGetMe,
  usersPatchMe,
  usersPatch, // þurfum ekki
  comparePasswords,
};
