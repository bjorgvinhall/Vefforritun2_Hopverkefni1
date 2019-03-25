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

  if (!isEmpty(password)) {
    if (password.length < 8) {
      errors.push({
        field: 'password',
        message: 'Password verður að vera amk. 8 stafir',
      });
    }
  }

  if (!isEmpty(email)) {
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
async function users(req, res) {
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
async function usersList(id) {
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
 * Uppfærir notanda
 * @param {number} id Auðkenni notanda
 * @param {User} user Notanda hlutur með gildum sem á að uppfæra
 * @param {boolean} admin Gildi sem segir til um hvort notandi sé stjórnandi
 * @returns {Result} Niðurstaða þess að búa til notandann
 * patch /users/:id
 */
async function usersPatch(id, { username, password, email }) {

  /* Ónotaður kóði, hunsa í smá
  const p = `
  SELECT * FROM users
  WHERE id = $1`;
  const prev = await query(p, [id]);
  const originalValues = prev.rows[0];
  console.log('Er notandinn admin? ' + originalValues.admin);
  */

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
  
  console.log('gildi: ' + values);

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

function serializeUser(user, done) {
  done(null, user.id);
}

async function deserializeUser(id, done) {
  try {
    const user = await findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}

async function createUser(username, password, email) {
  const hashedPassword = await bcrypt.hash(password, 11);

  const q = `
  INSERT INTO
  users (username, password, email)
  VALUES ($1, $2, $3, $4)`;

  return query(q, [username, hashedPassword, email]);
}

async function setAdmin(id, admin) {
  const q = `
UPDATE users
SET admin = $1
WHERE id = $2`;

  const result = await query(q, [admin, id]);

  return result;
}

async function comparePasswords(hash, password) {
  const result = await bcrypt.compare(hash, password);

  return result;
}

module.exports = {
  findByUsername, // til að login virki
  findById,
  userStrategy,
  usersList,
  usersPatch,
  createUser,
  users,
  setAdmin,
  comparePasswords,
};
