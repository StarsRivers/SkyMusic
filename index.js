var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var express = require("express");
//var cron = require("node-cron")
var nodemailer = require('nodemailer');
var hash = require('sha1')
//-----------------------------//
var app = express();
var mongoKey = process.env.mongoDBKey
var awaitingVerification = []
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'thoseskymodders@gmail.com',
      pass: process.env.pass
    }
  });
//



//
app.use(express.static('public'));
var bodyParser = require('body-parser');
app.use(bodyParser.json());
var port = process.env.PORT || 8080
setInterval(() => { //to replace with node-cron once i figure out what causes the problem
    removeUnusedVerification()
}, 60000);
 function removeUnusedVerification(){
    for(let i=0;i<awaitingVerification.length;i++){
        awaitingVerification[i].timesChecked ++
        if(awaitingVerification[i].timesChecked > 5){
            console.log("deleted verification by: "+awaitingVerification[i].email)
             awaitingVerification.splice(i,1)
              i--
        }
    }
 }
MongoClient.connect(mongoKey,  function(err, db1) {
    if (err) throw err;
    const db = db1.db("skyMusic");
//----------------------------------------------------------------------------------------------//
    app.get("/",function(req, res) {
        res.sendFile(__dirname+"/index.html")
    })
//----------------------------------------------------------------------------------------------//
app.post("/createAccount", async function(req, res) {
    var canProceed = true;
    var value = req.body;
    try{
        var colNames = await db.listCollections().toArray()
    }catch{
        res.send("Error while creating the account")
        canProceed = false;
    }
    for(let i=0;i<colNames.length;i++){
        //DOESNT WORK, TO FIX
        if(colNames[i].email == value.email){//checks if someone already registered with that mail
            res.send("This email is already in use")
            canProceed = false;
            break;
        }
        if(colNames[i].name == value.username){//checks if someone already registered with that username
            res.send("This nickname is already in use")
            canProceed = false;
            break;
        }
    }
    for(let i=0;i<awaitingVerification.length;i++){ //if there is already a request pending from this mail
        if(awaitingVerification[i].email == value.email){
            res.send("You have a pending verification, try again in 5 minutes") //request already existing
            canProceed = false;
            break;
        }
    }
    if(canProceed) sendVerificationCode(value), res.send(true) //sent verification, now it waits for next call from the user to verify the account
})
//----------------------------------------------------------------------------------------------//
    app.post("/verifyAccount", async function(req,res) {
        var value = req.body;
        let canProceed = false;
        var credentials;
        console.log(awaitingVerification[0])
        console.log(value)
        for(let i=0;i<awaitingVerification.length;i++){
            if(awaitingVerification[i].email == value.email){ //if there is a pending acceptation from this email
                if(awaitingVerification[i].code == value.code){ //if the code is correct
                    credentials = awaitingVerification[i]
                    awaitingVerification.splice(i,1)
                    canProceed = true;
                    break;
                }
            }
        }
        if(canProceed){
            console.log("Created account with name: "+credentials.username)
            try{
                db.createCollection(credentials.username,{capped: true, max:100, size: 5000000})
                var collection = db.collection(credentials.username)
                var finalhash = hash(hashwithseed(credentials.password))
                if(finalhash != null){
                collection.insertOne({_id:0, username: credentials.username, password: finalhash})
                }
            }catch{}
            res.send(true)
        }else{
            res.send("The code is not correct, try again!")
        }
    })
//----------------------------------------------------------------------------------------------//
app.post("/login", async function(req,res) {
    var value = req.body;
    //checks username length
    if(value.username.length > 64 || value.password.length > 128 || value.password.length < 5) {
        console.log("Invalid username or password length. Attempted username or password length : "+value.username.length+":"+value.password.length)
        res.send("Invalid credentials")
        return;
    } 
    if(!/^([0-9]|[a-z])+([0-9a-z]+)$/i.test(value.username)) {
        //checks for 
        res.send(false)
        return;
    }
        //checks username for special characters        
    try{
        var users = await db.listCollections().toArray()
    }catch{
        res.send("Error trying to access the DB")
        return
    }
    var userExists = false
    for(let i=0;i<users.length;i++){
        if(users[i].name == value.username){ //checks if the username exists
            userExists = true;
            break;
        }
    }
    if(userExists){
        var inputwithseed = hashwithseed(value.password)
        var collection = db.collection(value.username)
        var credentials = await collection.find({_id: 0}).toArray()
        if(credentials[0].password == hash(inputwithseed)){
            console.log("login done by: "+value.username)
            res.send(true)
        }else{
            console.log("Failed login by: "+value.username)
            res.send(false)
        }
    }else{
        console.log("User: "+value.username+" doesn't exist!")
        res.send(false)
    }
})

    app.post("/getSongs", async function(req,res) {
        var value = req.body;
        console.log(value)
        var collection = db.collection(value.username)
        var credentials = await collection.find({_id: 0}).toArray()
        if(credentials == undefined){
            res.send("Credentials wrong")
            return;
        }
        console.log(credentials[0])
        if(credentials[0].password == value.password){
            var allSongs = await collection.find().toArray()
                allSongs.splice(0,1) //removes the credentials
            var songsToSend = []
                for(var i=0;i<allSongs.length;i++){
                    songsToSend.push(allSongs[i].song)
                }
                res.send(songsToSend)
                console.log("songs sent to: "+value.username)
        }else{
            res.send("Credentials are wrong!")
        }
    })
    app.post("/saveSongs", async function(req,res) {
        var value = req.body;
        console.log(value)
        console.log("CHECK IF A SONG ALREADY EXISTS AND WARN THE USER")
        var collection = db.collection(value.username)
        var credentials = await collection.find({_id: 0}).toArray()
        console.log("limit the amount of songs u can store")
        if(credentials[0].password == value.password){
            for(var i=0; i<songsToSend.length;i++){
                collection.insertOne({song: value.song[i]})
            }
                console.log("added songs!")
        }else{
            res.send("Credentials are wrong!")
        }
    })
//----------------------------------------------------------------------------------------------//

    var server = app.listen(port, () => {
    console.log("server is running on port", server.address().port);
    });
});
//----------------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------------//
function sendVerificationCode(credentials){
    let verificationCode = ""
    for(var i=0;i<6;i++){
        verificationCode += Math.floor(Math.random()*9)
    }
    let verificationObj = {
        email: credentials.email,
        username: credentials.username,
        password: credentials.password,
        code: verificationCode,
        timesChecked : 0
    }
    var mailOptions = {
        from: 'thoseskymodders@gmail.com',
        to: credentials.email,
        subject: 'Verification',
        html: '<center><h1>Your code is: <font style="color: rgba(22, 22, 22, 0.65);">'
            +verificationCode
            +'</font><br><br> For username : <font style=" color: rgba(22, 22, 22, 0.65);">'
            +credentials.username
            +"</font></h1></center>"
      };
        transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
          awaitingVerification.push(verificationObj)
        }
      });
}
function hashwithseed(string) {
    var increment = 3;
    var input = "5zawL9hxo6m6fFbhJ2zN" + string;
    var output = "";
    while (increment < input.length) {
      if (increment % 2 == 0) {
        var output = output + input.charAt(increment);
      } else {
        var output = input.charAt(increment) + output;
      }
      increment++;
    }
    return output;
  }

  function hashwithseed(string) {
    var increment = 3;
    var input = "5zawL9hxo6m6fFbhJ2zN" + string;
    var output = "";
    while (increment < input.length) {
      if (increment % 2 == 0) {
        var output = output + input.charAt(increment);
      } else {
        var output = input.charAt(increment) + output;
      }
      increment++;
    }
    return output;
  }