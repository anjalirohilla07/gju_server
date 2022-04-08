const express = require('express');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
const cors = require('cors')
const axios = require('axios');
const func = require('./functions')

const uri = "mongodb+srv://gju_store:Anjali123@cluster0.frldy.mongodb.net/gju_store?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

client.connect(err => {
  const db = client.db("gju_store");
  console.log("connected...");

  app.get('/', async (req, res) => {
    console.log(req.body);
    res.send("Server running");
  });

  app.post('/login', async (req, res) => {
    console.log(req.body);

    const username = req.body.username;
    const password = req.body.password;
    const fcmToken = req.body.fcmToken;

    const query = {
      "username": username,
      "password": password
    }

    const row = await db.collection("customers").find(query).count();
    console.log(query, row); 

    if(row > 0)
    {
      await db.collection("customers").updateOne(query, { $set: { "fcmToken": fcmToken } });
      res.status(200).send("Login Successfully");
    } else {
      res.status(404).send("Incorrect Details");
    }
  });

  app.post('/register', async (req, res) => {
    console.log(req.body);

    const mailformat = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

    const fullname = req.body.fullname;
    const username = req.body.username;
    const email = req.body.email;
    const phoneNumber = req.body.phoneNumber;
    const password = req.body.password;

    const data = {
      "fullname": fullname,
      "username": username,
      "email": email,
      "phoneNumber": phoneNumber,
      "password": password
    }

    if(phoneNumber.length != 10)
    {
      res.send(404, "Invalid Mobile Number");
    }
    else if(!email.match(mailformat))
    {
      res.send(404, "Invalid Email Id");
    }
    else if(password.length < 8)
    {
      res.send(404, "Password should be more than 8 character.");
    }
    else if(await db.collection("customers").find(data).count() > 0)
    {
      res.send(404, "Already registered");
    } 
    else if(await db.collection("customers").find({ "username": username }).count() > 0)
    {
      res.send(404, "Username Already Exist")
    }
    else if(await db.collection("customers").find({ "email": email }).count() > 0)
    {
      res.send(404, "Email Already Exist")
    }
    else if(await db.collection("customers").find({ "phoneNumber": phoneNumber }).count() > 0)
    {
      res.send(404, "Phone Number Already Exist")
    }
    else {
        await db.collection("customers").insertOne(data);
        res.send(200, "Registered Successfully");
    }
  });

  app.post('/getProduct', async (req, res) => {
    console.log(req.body);

    const query = {
      "category": req.body.category,
      "sub-category": req.body['sub-category'],
      "$or": [{ "shop_id": { $exists: false } }, { "shop_id": req.body.shop_id }]
    }
    console.log(req.body['sub-category']);

    const row = await db.collection("products").find(query).count();

    if(row > 0)
    {
      const fetch = await db.collection("products").find(query).toArray();
      //console.log(fetch);
      res.send(fetch);
    } else {
      res.send([]);
    }
  });

  app.post('/seller/getProduct', async (req, res) => {
    console.log(req.body);

    const query = req.body;

    const row = await db.collection("products").find(query).count();

    if(row > 0)
    {
      const fetch = await db.collection("products").find(query).toArray();
      //console.log(fetch);
      res.send(fetch);
    } else {
      res.send([]);
    }
  });

  app.post('/seller/deleteProduct', async (req, res) => {
    console.log(req.body);

    const query = req.body;

    const row = await db.collection("products").find({ "_id": new ObjectId(req.body.productId) }).count();

    console.log(row);

    if(row == 1)
    {
      const fetch = await db.collection("products").remove({ "_id": new ObjectId(req.body.productId) });
      res.send(200, "Successfully Deleted");
    } else {
      res.send(404, "Error!!");
    }
  });

  app.post('/addProduct', async (req, res) => {
    console.log(req.body);

    const query = req.body;

    const row = await db.collection("products").insertOne(query);

    res.send(200, "Product Added Successfully");
  });

  app.post('/getProfile', async (req, res) => {
    console.log(req.body);

    const query = req.body;
    const row = await db.collection("customers").findOne(query);
    console.log(row)
    res.send(row);
  });

  app.post('/createOrder', bodyParser.json(), async (req, res) => {
    console.log(req.body);

    await db.collection("orders").insertOne(req.body);
    const r = await db.collection("customers").findOne({ "username": req.body.username });

    await func.sendEmail(req.body.username, r.email, req.body);

    const row = await db.collection("sellers").findOne({ "_id": new ObjectId(req.body.shop_id) });
      //console.log(id)
    var clientToken = row.fcmToken;

    const url = "https://fcm.googleapis.com/fcm/send"
    const headers = {
      "Content-Type": "application/json",
      "Authorization":"key=AAAAxfl2Mqo:APA91bEAUNppj3nfoBsHmrpJolNrD-VTAt4MyDtQE-wGXVF4Mz2B32dpP1qfz-D3EDqBgL-9xED6scFSHxk65s0vCUcKkelMt7fniZzJJ-WWq5Z3du4-_2DPBeFVMVFD8jHW_XgCvOeB"
    }
    const msg = {
      "data":{
          "body":"You have received a Order",
          "title":"ZapZoo"
        },
      "to": clientToken
    } 

    const resp = await axios.post(url, msg, { "headers": headers });
    console.log(resp.data);

    res.send(200, "success");
  });

  app.get('/sendemail', async (req, res) => {
    console.log(req.query);

    const r = await db.collection("customers").findOne({ "username": req.query.username });
    console.log(r)
    await func.sendEmail(req.body.username, r.email, { "timestamp": 16245785 });
    res.send(200, "success");
  });

  app.post('/fetchOrder', async (req, res) => {
    console.log(req.body);

    const username = req.body.username;

    const query = {
      "username": username
    }

    const fetch = await db.collection("orders").find(req.body).sort({ "timestamp": -1 }).toArray();
    console.log(fetch);

    res.send(200, fetch);
  });

  app.post('/search', async (req, res) => {
    console.log(req.body);

    const searchquery = { $text: { $search: req.body.query, $caseSensitive: false } };
    const row = await db.collection("products").find(searchquery).count();

    if(row > 0)
    {
      const fetch = await db.collection("products").find(query).limit(10).toArray();
      console.log(fetch);
      res.send(fetch);
    } else {
      res.send([]);
    }
  });

  app.get('/getNearbyStores', async (req, res) => {
    console.log(req.query);

    const lat = req.query.lat;
    const lng = req.query.lng;

    const url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location="+lat+","+lng+"&rankby=distance&type=supermarket&key=AIzaSyBTWpbHWfWgdqOyeuHqLwox-nEgYn8hHjs"

    const resp = await axios.get(url);
    //console.log(resp.data.results); 

    var shops = []

    const fetchstores = await db.collection("sellers").find({}).toArray();

    for(var i in fetchstores)
    {
      const data = {
        "shop_id": fetchstores[i]._id,
        "shopName": fetchstores[i].storeName,
        "lat": fetchstores[i].lat,
        "lng": fetchstores[i].lng,
        "storeImageUrl": fetchstores[i].storeImageUrl
      }
      shops.push(data);
    }

    for(var i in resp.data.results)
    {
      const imageUrl = (resp.data.results[i].photos === undefined ? "null" : resp.data.results[i].photos[0].photo_reference);

      const data = {
        "shop_id": "0",
        "shopName": resp.data.results[i].name,
        "lat": resp.data.results[i].geometry.location.lat,
        "lng": resp.data.results[i].geometry.location.lng,
        "storeImageUrl": "https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&key=AIzaSyBTWpbHWfWgdqOyeuHqLwox-nEgYn8hHjs&photoreference="+imageUrl,
      }
      shops.push(data);
      //console.log(data);
    }

    console.log(shops);
    res.json(shops);
  });

  app.post('/seller/login', async (req, res) => {
    console.log(req.body);

    const mobileNumber = req.body.mobileNumber;
    const password = req.body.password;
    const fcmToken = req.body.fcmToken;

    const query = {
      "mobileNumber": mobileNumber,
      "password": password
    }

    const row = await db.collection("sellers").find(query).count();
    //console.log(query, row); 

    if(row > 0)
    {
      await db.collection("sellers").updateOne(query, { $set: { "fcmToken": fcmToken } });
      const id = await db.collection("sellers").findOne(query);
      //console.log(id)
      var o_id = new ObjectId(id._id);
      console.log(o_id)
      res.status(200).send(""+o_id);
    } else {
      res.status(404).send("Incorrect Details");
    }
  });

  app.post('/seller/register', async (req, res) => {
    console.log(req.body);
    const mailformat = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

    const firstName = req.body.firstName;
    const lastName = req.body.lastName;
    const mobileNumber = req.body.mobileNumber;
    const email = req.body.email;
    const storeName = req.body.storeName;
    const govtLicense = req.body.govtLicense;
    const gstin = req.body.gstin;
    const category = req.body.category;
    const password = req.body.password;
    const fcmToken = req.body.fcmToken;
    const lat = req.body.lat;
    const lng = req.body.lng;
    const storeImageUrl = req.body.storeImageUrl+"?alt=media";
    const upi = req.body.upi;

    const data = {
      "firstName": firstName,
      "lastName": lastName,
      "mobileNumber": mobileNumber,
      "email": email,
      "storeName": storeName,
      "govtLicense": govtLicense,
      "gstin": gstin,
      "category": category,
      "password": password,
      "fcmToken": fcmToken,
      "lat": lat,
      "lng": lng,
      "storeImageUrl": storeImageUrl,
      "upi": upi
    }

    if(mobileNumber.length != 10)
    {
      res.send(404, "Invalid Mobile Number");
    }
    else if(email != '' && !email.match(mailformat))
    {
      res.send(404, "Invalid Email Id");
    }
    else if(password.length < 8)
    {
      res.send(404, "Password should be more than 8 character.");
    }
    else if(await db.collection("sellers").find(data).count() > 0)
    {
      res.send(404, "Already registered");
    }
    else if(email != '' && (await db.collection("sellers").find({ "email": email }).count()) > 0)
    {
      res.send(404, "Email Already Exist")
    }
    else if(await db.collection("sellers").find({ "mobileNumber": mobileNumber }).count() > 0)
    {
      res.send(404, "Phone Number Already Exist")
    }
    else if(await db.collection("sellers").find({ "gstin": gstin }).count() > 0)
    {
      res.send(404, "GSTIN Already Registered")
    }
    else if(gstin.length != 15)
    {
      res.send(404, "Invalid GSTIN Number")
    }
    else if(govtLicense.length != 15)
    {
      res.send(404, "Invalid Govt. License Number")
    }
    else {
        await db.collection("sellers").insertOne(data);
        res.send(200, "Registered Successfully");
    }
  });

  app.post('/seller/getOrder/allorders', async (req, res) => {
    console.log(req.body);

    const fetch = await db.collection("orders").find(req.body).sort({ "timestamp": -1 }).toArray();
    
    console.log(fetch)
    
    res.send(fetch);
  });

  app.post('/seller/changeStatus', async (req, res) => {
    console.log(req.body);

    const query = {
      "shop_id": req.body.shop_id,
      "timestamp": Number(req.body.timestamp)
    }

    console.log(query);

    await db.collection("orders").updateOne(query, { $set: { "status": req.body.status } });
    //console.log(query, row); 

    const row = await db.collection("customers").findOne({ "username": req.body.username });
      //console.log(id)
    var clientToken = row.fcmToken;

    const url = "https://fcm.googleapis.com/fcm/send"
    const headers = {
      "Content-Type": "application/json",
      "Authorization":"key=AAAAxfl2Mqo:APA91bEAUNppj3nfoBsHmrpJolNrD-VTAt4MyDtQE-wGXVF4Mz2B32dpP1qfz-D3EDqBgL-9xED6scFSHxk65s0vCUcKkelMt7fniZzJJ-WWq5Z3du4-_2DPBeFVMVFD8jHW_XgCvOeB"
    }
    const msg = {
      "data":{
          "body":"Your Order has been "+req.body.status,
          "title":"ZapZoo"
        },
      "to": clientToken
    } 

    const resp = await axios.post(url, msg, { "headers": headers });
    console.log(resp.data);

    res.status(200).send("Status Updated");
  });

  app.get('/seller/getOrder/accepted', async (req, res) => {
    console.log(req.params);


    res.send([]);
  });

  app.post('/seller/updateStoreImage', async (req, res) => {
    console.log(req.body);


    res.send([]);
  });
  
});

app.listen(8080, function() {
    console.log('listening on 8080')
})