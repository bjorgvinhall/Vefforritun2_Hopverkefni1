const xss = require('xss');

/**
* Higher-order fall sem umlykur async middleware með villumeðhöndlun.
*
* @param {function} fn Middleware sem grípa á villur fyrir
* @returns {function} Middleware með villumeðhöndlun
*/
function catchErrors(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

/**
* Passar upp á að það sé innskráður notandi í request. Skilar næsta middleware
* ef svo er, annars redirect á /login
*
* @param {object} req Request hlutur
* @param {object} res Response hlutur
* @param {funcion} next Næsta middleware
*/
function ensureLoggedIn(req, res, next) {
  console.log("ensureLoggedIn", req.user);
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'invalid token' });
}

/**
* Passar upp á að innskráður notandi sé admin. Skilar næsta middleware ef svo
* er, annars redirect á /login
*
* @param {object} req Request hlutur
* @param {object} res Response hlutur
* @param {funcion} next Næsta middleware
*/
function ensureAdmin(req, res, next) {
  console.log("ensureAdmin", req.user);
  if (req.isAuthenticated() && req.user && req.user.admin) {
    return next();
  }
  return res.status(401).json({ error: 'invalid token' });
}

/**
* Hjálparfall sem XSS hreinsar reit í formi eftir heiti.
*
* @param {string} fieldName Heiti á reit
* @returns {function} Middleware sem hreinsar reit ef hann finnst
*/
function sanitizeXss(fieldName) {
  return (req, res, next) => {
    if (!req.body) {
      next();
    }

    const field = req.body[fieldName];

    if (field) {
      req.body[fieldName] = xss(field);
    }

    next();
  };
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

module.exports = {
  catchErrors,
  ensureLoggedIn,
  ensureAdmin,
  sanitizeXss,
  isEmpty,
};
