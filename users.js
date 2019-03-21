const bcrypt = require('bcrypt');
const { query } = require('./db');

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
 * Skilar lista af notendum gegnum GET
 * @param {*} req  Request hlutur
 * @param {*} res Response hlutur
 * @returns {array} Fylki af notendum
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
 */
async function usersList(id) {
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

async function createUser(username, password, name, email) {
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
  userStrategy,
  usersList,
  createUser,
  users,
  setAdmin,
  comparePasswords,
};
