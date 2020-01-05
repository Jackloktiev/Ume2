const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const path = require("path");

const App = express();
App.use(express.static(path.join(__dirname,"/build")));
App.use(bodyParser.urlencoded({extended:true}));

//--Security set up --
App.use(session({
    secret:"This is my greduation project!",
    resave:false,
    saveUninitialized:false
}));
App.use(passport.initialize());
App.use(passport.session());

//---Set up Data Base---
mongoose.connect("mongodb://localhost:27017/UmeDB",{ useNewUrlParser: true,  useUnifiedTopology: true });

//--Define User collection--
const userShema = new mongoose.Schema ({
    username: String,
    name: String,
    password: String,
    gender: String,
    age:Number,
    height:Number,
    weight:Number,
    lvlOfActivity:String,
    consumption:Array,
    normCalories:Number,
    normFats:Number,
    normProteins:Number,
    normCarbs:Number
});
userShema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userShema);
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//--Define collection of food and drinks--
const itemShema = new mongoose.Schema ({
    id:Number,
    category:String,
    restaurant:String,
    name:String,
    imageUrl:String,
    caloriesPer100g:Number,
    fatsPer100g:Number,
    carbsPer100g:Number,
    proteinsPer100g:Number
});
const Item = mongoose.model("Item",itemShema);

//--Define restaurant collection--
const restaurantShema = new mongoose.Schema({
    name:String,
    logoUrl:String
});
const Restaurant = mongoose.model("Restaurant",restaurantShema);


//---Define routes---
//--Home route--
App.get("/", function(req,res){

    if(req.isAuthenticated()){
        res.redirect("/"); 
    }else{
        res.redirect("/login");
    }
    
});

App.get("/user", function(req,res){

    if(req.isAuthenticated()){
        res.redirect("/user"); 
    }else{
        res.redirect("/login");
    }
    
});

//--Register new user route--
App.post("/register", function(req,res){
    User.register({username:req.body.username},req.body.password,function(err,user){
        console.log(user);
        if(err){
            console.log(err);
            res.send("/register");
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/user/?user=" + req.body.username);
            });
        }
    });
})

App.post("/login",function(req,res){
    const user = new User({
        username:req.body.username,
        password:req.body.password
    });

    req.login(user,function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/");
            });
        }
    });
});

App.get("/logout",function(req,res){
    req.logout();
    res.redirect("/");
});

//--Add consumed item route--
App.post("/consumed", function(req,res){
    //Calculate consumption of nutrients depending on amount of food
    let cal = req.body.calories/100*req.body.quantity;
    let prot = req.body.proteins/100*req.body.quantity;
    let carbs = req.body.carbs/100*req.body.quantity;
    let fat = req.body.fats/100*req.body.quantity;

    var meal = {
        date:req.body.date,
        calories:cal,
        fats:fat,
        carbs:carbs,
        proteins:prot,
        amount:req.body.quantity
    }
    User.updateOne({username:req.body.username},{$push:{consumption:meal}},function(err){
        if(err){
            console.log(err);
            res.send("Ooops!");
        }else{
            console.log("meal has been added")
            res.redirect("/");
        }
    });
})

//--Add route to record weight, age and other parameters and return norms for carbs, fats, proteins and calories--
App.post("/userprofile", function(req,res){

    function proteinNorm (weight,activity){
        var norm = 0;
        if(activity==="low"){
            norm = parseFloat(weight);
        }else if(activity==="sport"){
            norm = parseFloat(weight)*1.6;
        }else{
            norm = parseFloat(weight)*1.3;
        }
        return norm;
    };

    function carbsNorm (weight,activity){
        var norm = 0;
        if(activity==="low"){
            norm = parseFloat(weight)*3;
        }else if(activity==="sport"){
            norm = parseFloat(weight)*5;
        }else{
            norm = parseFloat(weight)*6;
        }
        return norm;
    };
    function fatsNorm (weight){
        var norm = parseFloat(weight)*0.8;
        return norm;
    };

    function BMR (gender,weight,height,age){
        var BMR = 0;
        if(gender==="male"){
            BMR = (10*parseFloat(weight))+(6.25*parseFloat(height))-(5*parseFloat(age))+5;
            return BMR;
        }else if(gender==="female"){
            BMR = (10*parseFloat(weight))+(6.25*parseFloat(height))-(5*parseFloat(age))-161;
            return BMR;
        }else{
            return BMR = 0;
        }
    };

    function AMR(levelOfActivity){
        if(levelOfActivity==="low"){
            return 1.2;
        }else if(levelOfActivity==="moderate"){
            return 1.375;
        }else if(levelOfActivity==="average"){
            return 1.55;
        }else if(levelOfActivity==="high"){
            return 1.725;
        }else if(levelOfActivity==="sport"){
            return 1.9;
        }else{
            return 0;
        }
    };
    
    var userName = req.body.username;
    var name = req.body.name;
    var userGender = req.body.gender;
    var userAge = req.body.age;
    var userHeight = req.body.height;
    var userWeight = req.body.weight;
    var userActivity = req.body.activity;
    var normCalories = BMR(req.body.gender,req.body.weight,req.body.height,req.body.age)*AMR(req.body.activity);
    var normFats = fatsNorm(req.body.weight);
    var normProteins = proteinNorm(req.body.weight, req.body.activity)
    var normCarbs = carbsNorm(req.body.weight, req.body.activity)

    
    User.updateOne({username:userName},{
        gender:userGender,
        name:name,
        age:userAge,
        height:userHeight,
        weight:userWeight,
        lvlOfActivity:userActivity,
        normCalories:normCalories,
        normFats:normFats,
        normProteins:normProteins,
        normCarbs:normCarbs
        },
        function(err){
            if(!err){
                res.redirect("/");
            }else{
                res.send(err);
            }
        }
    );
});

//--Add route to get norms for carbs, fats, proteins and calories--
App.get("/userProfile/:username", function(req,res){
    if(req.params.username){
    User.findOne({username:req.params.username}, function(err,foundUser){
        if(err){
            res.send(err);
        }else{
            const Now = new Date();
            const currentDate = Now.getMonth() + "-" + Now.getDate() + "-" + Now.getFullYear();
            function Add (array){
                let result = [];
                let calories = 0;
                let proteins = 0;
                let carbs = 0;
                let fats = 0;
                array.map(function(x){                    
                    if(x.date===currentDate){
                        calories = calories + parseFloat(x.calories);
                        proteins = proteins + parseFloat(x.proteins);
                        carbs = carbs + parseFloat(x.carbs);
                        fats = fats + parseFloat(x.fats);
                        
                    };
                })
                result.push(calories);
                result.push(proteins);
                result.push(carbs);
                result.push(fats);
                return result;
            };
            [caloriesSum, proteinsSum, carbsSum, fatsSum] = Add(foundUser.consumption);

            let userProfile = {
                age:foundUser.age,
                gender:foundUser.gender,
                name:foundUser.name,
                height:foundUser.height,
                weight:foundUser.weight,
                lvlOfActivity:foundUser.lvlOfActivity,
                fatsNorm:foundUser.normFats,
                proteinsNorm:foundUser.normProteins,
                carbsNorm:foundUser.normCarbs,
                caloriesNorm:foundUser.normCalories,
                calories: caloriesSum,
                proteins: proteinsSum,
                carbs: carbsSum,
                fats:fatsSum
            }
            res.send(userProfile);
        }
    })}else{
        res.send("user is undefined");
    }           
});

//--Add new food item to the database--
App.post("/newFoodItem",function(req,res){
    var itemID = 0;
    var itemCategory = req.body.category;
    var itemRestaurant = req.body.restaurant;
    var itemName = req.body.name;
    var itemImageUrl = req.body.imageUrl;
    var itemCalories = req.body.calories;
    var itemFats = req.body.fats;
    var itemCarbs = req.body.carbs
    var itemProteins = req.body.proteins
        
    const foodItem = new Item ({
        id: itemID,
        category: itemCategory,
        restaurant: itemRestaurant,
        name: itemName,
        imageUrl: itemImageUrl,
        caloriesPer100g: itemCalories,
        fatsPer100g: itemFats,
        carbsPer100g: itemCarbs,
        proteinsPer100g: itemProteins
    })
    foodItem.save(function(err){
        if(err){
            console.log(err);
            res.send("Error on adding food item");
        }else{
            console.log("food item added sucesfully");
            res.send("Food item added sucesfully!");
        }
    });
})

//--get entire collection of food--
App.get("/getFood",function(req,res){

    Item.find({},function(err,foundItems){
        if(err){
            console.log(err);
            res.send(err);
        }else{
            res.send(foundItems);
        }
    });
});

//--get list of restaurants--
App.get("/getRestaurant",function(req,res){
    Restaurant.find({},function(err,foundItems){
        if(err){
            console.log(err);
            res.send(err);
        }else{
            res.send(foundItems);
        }
    });
});

App.get('*', function(req,res){
    res.sendFile(path.join(__dirname + "/build/index.html"));
});

App.listen(8000, function(){
    console.log("Back-end server is running on port 8000.")
});