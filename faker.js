const faker = require('faker');
const fs = require('fs');

const productAmount = 1000;
const categoryAmount = 12;
const images = [];
const categories = [];

// Finnum mismunandi flokka fyrir vörur
while (categories.length !== categoryAmount) {
  const cat = faker.commerce.department();
  if (!categories.includes(cat)) {
    categories.push(cat);
  }
}
console.log(categories);

// lesum inn myndir í fylki
fs.readdirSync('./img/').forEach((file) => {
  images.push(file);
});
console.log(images.length);


for (let i=0; i<productAmount; i++) { // eslint-disable-line
  const title = faker.commerce.product();
  const price = faker.commerce.price();
  const text = faker.lorem.paragraphs();
  const image = images[Math.floor(Math.random() * 20)];
  const category = categories[Math.floor(Math.random() * 12)];
  console.log(title, ' : ', category, price, image, text, '\n\n');

  // todo: setja vörur og flokka inn í gagnagrunn

  faker.helpers.randomize();
}
