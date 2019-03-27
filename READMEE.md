# Hópverkefni 1

## Hópmeðlimir
Nemendur og notendanöfn verkefnis: 
* Björgvin Hall
    * bjh45@hi.is
* Emma Líf Jónsdóttir
    * elj44@hi.is
* Friðrik Árni Halldórsson
    * fah13@hi.is
* Melkorka Mjöll Jóhönnudóttir
    * mmj8@hi.is

## Setja upp verkefnið

```bash
> git clone https://github.com/bjorgvinhall/vef2-hop1
> cd vef2-hop1 # opna skjalið þar sem verkefni er í
> npm install 
> node setup.js # setja upp gagnagrunninn
> node faker.js # búa til gögn og sett í gagnagrunninn
> nodemon app.js # keyrt verkefnið
```

## Dæmi um notkun

Til að sjá lista yfir allar mögulegar aðgerðir skal velja GET á `/` 

* Til að búa til nýjan notanda skal fara á 
    *  `POST` á `/users/register` og stimpla inn notendanafn, lykilorð og email. 
    * Hér er dæmi
    ```bash
    {
    "username": "broskall",
    "password": "smiley123",
    "email": "smile@org.com"
    }
    ```
* Til að skoða síðu með öllum vörum er hægt að fara á `GET` á `products`
* Ef notandi vill skoða einhvern sérstakan flokk þá getur hann leitað af honum á `GET` á `/categories`
* Ef notandi vill setja vöru í körfuna sína þá skal hann fara `POST` á `/cart` og bætir við vöru með að skrifa titil hennar eins og t.d.

     ``` bash
    {
        "title": "Incredible Fresh Soap"
    }
    ```
* Síðan getur notandi skoðað allar vörurnar sínar með reiknuðu heildarverði með því að fara á `GET` á `/cart`

## Skrá sig inn sem admin

Til að skrá sig inn sem admin þarf að `POST` á `users/login` og stimpla inn netfang og lykilorð

```bash
{
    "email": "admin@example.com"
    "password": "12341234"
}
```

