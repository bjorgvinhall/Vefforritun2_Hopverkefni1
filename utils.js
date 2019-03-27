const xss = require('xss');

const cloudinary = require('cloudinary');

// const { query } = require('./db');

const {
  CLOUDINARY_CLOUD,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

if (!CLOUDINARY_CLOUD || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn('Missing cloudinary config, uploading images will not work');
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

async function uploadCloudinary(path) {
  if (!path) {
    console.error('Unable to read image');
  }
  let upload = null;

  try {
    upload = await cloudinary.v2.uploader.upload(path);
  } catch (error) {
    if (error.http_code && error.http_code === 400) {
      console.error(error.message);
    }

    console.error('Unable to upload file to cloudinary:', path);
    return error;
  }
  const link = upload.secure_url;
  return link;
}

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
  sanitizeXss,
  isEmpty,
  uploadCloudinary,
};
