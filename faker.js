/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable no-continue */
const faker = require('faker');
const fs = require('fs');
const cloudinary = require('cloudinary');

const { query } = require('./db');

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

async function main() {
  const productAmount = 1000;
  const categoryAmount = 12;
  const images = [];
  const imagesURL = [];
  const categories = [];
  const products = [];
  // Byrjum á að tæma töflurnar áður en við setjum inn vörur
  await query('DELETE FROM products');
  await query('DELETE FROM categories');
  // Finnum mismunandi flokka fyrir vörur
  while (categories.length !== categoryAmount) {
    const cat = faker.commerce.department();
    if (!categories.includes(cat)) {
      categories.push(cat);
      await query('INSERT INTO categories (category) VALUES ($1)', [cat]);
    }
  }

  // lesum inn myndir í fylki
  fs.readdirSync('./img/').forEach((file) => {
    images.push(`./img/${file}`);
  });

  let cloud;
  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    cloud = await uploadCloudinary(file);
    imagesURL.push(cloud);
    console.log("image", i + 1, "uploaded");
  }

  while (products.length < productAmount) {
    const title = faker.commerce.productName();
    // Ef vara er nú þegar til þá reynum við aftur (continue)
    if (products.includes(title)) continue;
    products.push(title);
    const price = parseInt(faker.commerce.price(), 10);
    // þægilegra að hafa stuttan texta á meðan við erum að vinna verkefnið
    // Breyta: text = faker.lorem.paragraphs(); áður en við skilum
    const text = faker.lorem.paragraphs();
    const image = imagesURL[Math.floor(Math.random() * 20)];
    const category = categories[Math.floor(Math.random() * 12)];

    await query(`INSERT INTO products (title, price, text, imgurl, category)
    VALUES ($1 ,$2, $3, $4, $5)`, [title, price, text, image, category]);
  }
  console.log('\nFaker uppsett\nfjöldi slóða á myndir:', imagesURL.length,
    '\nfjöldi flokka:', categories.length,
    '\nfjöldi vara:', products.length);
}

main().catch((err) => {
  console.error(err);
});

module.exports = {
  uploadCloudinary,
};
