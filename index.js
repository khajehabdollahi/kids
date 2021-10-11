if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const session = require("express-session");
const path = require("path");
const mongoose = require("mongoose");

const nodemailer = require("nodemailer");
const mailer = require("./views/mailer");
const mailerForget = require("./views/mailerForget");

const Donate = require("./models/Donation");
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const flash = require("connect-flash");

const User = require("./models/User");
const Newkid = require("./models/Kids");


const MongoStore = require("connect-mongo");

const multer = require("multer");

const uuid = require("uuid");

const { storage } = require("./cloudinary/index");
const console = require("console");

const upload = multer({ storage });

// const dbUrl = "mongodb://localhost:27017/emdaad";
const dbUrl = "mongodb+srv://admin:admin@kids.ieo4r.mongodb.net/emdaad?retryWrites=true&w=majority";

mongoose.connect(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

const store = MongoStore.create({
  mongoUrl: dbUrl,
  touchAfter: 24 * 60 * 60,
  crypto: {
    secret: "thisshouldbeabettersecret!",
  },
});

store.on("error", function (e) {
  console.log("Error to save to dataBase", e);
});

const sessionConfig = {
  store,
  secret: "thisshouldbeabettersecret!",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};

app.use(session(sessionConfig));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.engine("ejs", ejsMate);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

const requiredLogin = (req, res, next) => {
  if (!req.user) {
    return res.redirect("/login");
  }
  next();
};
const ifAdmin = (req, res, next) => {
  if (req.user.username!='pkhajeh@gmail.com') {
    return res.redirect("/login");
  }
  next();
};

app.get("/secret", (req, res) => {
  if (!req.session.user_id) {
    return res.redirect("/login");
  }
  res.render("secret");
});

app.get("/newones", requiredLogin, (req, res) => {
  res.render("newone");
});


app.post("/newkid", upload.single("image"), async (req, res) => {
  // console.log(req.body, req.file)
  const input = req.body;
  const kid = new Newkid(input);
  // kid.image = req.file.path;
  kid.creator.username = req.user.username;
  kid.creator.name = req.user.name;
  kid.creator.id = req.user.id;

  await kid.save();
  res.redirect("/");
});

app.get("/newkid/:id", async (req, res) => {
  const { id } = req.params;
  const kid = await Newkid.findById(id).populate("creatorbyId");
  const donations = await Donate.find({ kidId: id });
 
  res.render("kidDetail", { kid, donations });
});

app.get("/newkid/:id/edit", requiredLogin, async (req, res) => {
  const { id } = req.params;
  const kid = await Newkid.findById(id);
  res.render("edit", { kid });
});

app.put("/newkid/:id", upload.single("image"), async (req, res) => {
  const { id } =  req.params;
  // const kid = await Newkid.findById(id);
  //  kid.image = req.file.path
  

  const kid =await Newkid.findByIdAndUpdate(id, req.body,  {
    runValidators: true,
    new: true,
   
  });
// kid.image = req.file.path;
  kid.save();
  res.redirect("/Kids");
});

app.get("/kiddeleteconfirm/:id", async (req, res) => {
  const { id } = await req.params;

  const kid=await Newkid.findById(id);
  //  req.flash("mes", "Yes deleted a kid");
  res.render("deleteKid",{id,kid});
});

app.delete("/newkid/:id", async (req, res) => {
  const { id } = await req.params;

  await Newkid.findByIdAndDelete(id);
  //  req.flash("mes", "Yes deleted a kid");
  res.redirect("/");
});

app.get("/new", (req, res) => {
  req.session.returnTo = req.originalUrl;
  res.render("newkid");
});

app.get("/kids", async (req, res) => {
  const kids = await Newkid.find();
  // res.send(kids);
  res.render("kids", { kids });
});

app.get("/", (req, res) => {
  res.render("home");
});

//CHECK STRING LENGTH
const isValidData = (value, stringLength) => {
  let inValid = new RegExp("^[_A-z0-9]{1,}$");
  let result = inValid.test(value);
  if (result && value.length >= stringLength) {
    return true;
  }
  return false;
};

//REGISTER USER
app.get("/register", (req, res) => {
  res.render("registerr");
});

app.post("/register", async (req, res) => {
  let username = req.body.username;
  let name = req.body.name;

  let inputPassword = req.body.password;
  console.log("PASSWORD: ", username)
  let password;

  if (!isValidData(inputPassword, 6)) {
    console.log("Password must be at least 6 characters without space!");
  } else {
    password = inputPassword
  }

  const newUser = new User({
    username,
    name,
    activated: false,
  });

  await User.register(newUser, password);
  // req.session.user_id = user._id;
  let { id } = await User.findOne({ username: username });
  mailer(
    username,
    "Welcome to web",
    "Yes you are very welcome now \n please activate ur account by clicking this link\n \n http://localhost:3000/activate/" +
      id
  ); //Detta lokal host ska ändras till domänen
  res.render("registerSuccess", { newUser });
  // res.render('login', {user})
});

app.get("/activate/:id", async (req, res) => {
  let user = await User.findOne({ _id: req.params.id });
  if (user) {
    user.activated = true;
    await user.save();
    res.send("Account is activated now");
    res.redirect("http://localhost:3000/welcomeuser?id=" + req.params.id).end();
    res.render("loginWelcome");
  } else {
    res.send("Activation Failed");
  }
});

app.get('/users/edit/:id', async (req, res) => {
  const { id } = req.params
  const user = await User.findById(id);
  res.render('edituser', { user })
});

app.put("/users/edit/:id", async (req, res) => {
  const { id } = await req.params;
  console.log("id: ");

  const user = await User.findByIdAndUpdate(id, req.body, {
    runValidators: true,
    new: true,
  
  });
  user.save();
  res.redirect('/')
});

app.get('/deleteuser/:id', async (req, res) => {
  const { id } = await req.params;
  res.render('confimDeleteUser',{id})
})

app.get('/deleteuserconfirmed/:id', async (req, res) => {
  const { id } = await req.params;
    
  await User.findByIdAndDelete(id)
 
  res.redirect('/')
});

app.get("/login", async (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res, next) => {
  await passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user.username) {
      const worngUser = req.body.username;
      return res.render("wrongEmail", { worngUser });
    }
    if (!user) {
      const worngUser = req.body.username;
      return res.render("wrongpassword", { worngUser });
    }
    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }
      return res.render("loginWelcome",{ user});
    });
  })(req, res, next);
});

// creating admin pages

app.get('/admin',requiredLogin, ifAdmin, (req,res)=>{
  
  res.render('admin')
})

app.post('/admin',async (req, res)=>{
  const { username } = req.body;
  await User.find({ username: username }).remove().exec();
  // res.status(200).send(username);
  res.redirect("/admin")
});

app.get("/forgetpass", (req, res) => {
  let tempid = uuid.v4();
  res.render("foreget", {tempid});
});

app.post("/forgetpass", (req, res) => {
  const { username } = req.body
  const user = User.find({ "username": username });
  console.log("FOUND USER", user.name)
})


  
app.post("/forgetpass/:tempid", async (req, res) => {
  const {tempid}=await req.params;
  const { username } = req.body;

  await User.find({ username }, function (err, user) {
    if (err) {
      console.log(err);
    } else {
      res.send(user);
      mailerForget(
        username,
        "Welcome to web",
        "Yes you are very welcome now \n please activate ur account by clicking this link\n \n (http://localhost:3000/resetpass/" +
          tempid+'/'+username
      );
      //Detta lokal host ska ändras till domänen
    }
  });
});

//RESET PASSWORD
app.get("/resetpass/:tempid/:username", async (req, res) => {
  const { tempid } =await  req.params;
  const { username } =await req.params;
  res.render("resetpass", { tempid,username });
});

app.put("/resetpass/:tempid/:username", async (req, res) => {
  const { username } = req.body;
  console.log(username.substring(username.indexOf("/") + 1));
  const { password } = req.body;

  await User.findOne({ username }, (err, user) => {
    if (err) {
      res.send("Password reset Failed");
    } else {
      console.log("USER:", user);
      user.setPassword(password, (error, returnedUser) => {
        if (error) {
          console.log(error);
        } else {
          returnedUser.save();
        }
      });
      res.redirect('/login');
    }
  });
});

app.get("/users", async (req, res) => {
  const allUsers = await User.find({});
  res.render("allUsers", { allUsers });
});

app.get("/users/:id", async (req, res) => {
  const { id } = req.params;
  console.log("id: ", id);
  const user = await User.findById(id);
   const kid = await Newkid.find({ "creator.id": id });
 
  res.render("showuser", { user, kid,id});
});

app.get("/donate/:id", requiredLogin, async (req, res) => {
  const { id } = req.params;
   const kid =await Newkid.findById(id);
  
  res.render("donate", { kid });
});

app.get("/users/:username", async (req, res) => {
  const { username } = req.params;
  console.log("username: ", username);
  const user = await User.findById(username);
  console.log(user);
  res.render("showuser", { user });
});



app.post("/d", async (req, res) => {
  // const donate=req.body
  const donated = new Donate(req.body);
  

  donated.kidId = req.body.kidId;
  // donated.donatorsname = req.body.doneatorId;

  const donator = await User.findById(req.body.doneatorId);
 
  donated.donatorsname = donator.name;
  const date1 = Date.now();
   donated.date=date1.toString()

  await donated.save();

  res.redirect("/");
  // res.render("donated", {id, donateAmount });
});

app.get("/donateconfirm/:id/:bid", async (req, res) => {
  const { id } = req.params;
  const { bid } = await req.params;
  const donate = await Donate.findById(id);
  const kid = await Newkid.findById(bid);

  res.render("donateconfirm", { donate, kid });
});

app.put("/donateconfirm/:id/:bid", async (req, res) => {
  
  const { id } = await req.params;
  const { bid } = await req.params;
 
  const kid = await Newkid.findById(bid);
  const confirmedAmount =Number(req.body.confirmedAmount);
  const donate = await Donate.findByIdAndUpdate(id);
  // kid.totalDonatedAmount = kid.totalDonatedAmount - donate.confirmedAmount;
  // res.send(kid.totalDonatedAmount);
  const confirmation =Number(req.body.confirmation);
  // res.send(kid)
  Number(confirmedAmount)
  Number(kid.totalDonatedAmount);
  const total = kid.totalDonatedAmount + confirmedAmount;
  // kid.totalDonatedAmount = kid.totalDonatedAmount + confirmedAmount;
  console.log('total is:',total)
  // kid=Newkid.findByIdAndUpdate(bid)
  kid.totalDonatedAmount=Number(total);
  donate.confirmation = confirmation;
  donate.confirmedAmount =Number(confirmedAmount);
  console.log(donate);
  donate.save();
  kid.save()
  res.redirect(`/kids`);
});

app.get('/editconfiremdamount/:id/:bid', async (req, res) => {
  const { id } = req.params;
  const { bid } = req.params;
  const donate = await Donate.findById(id)
  const kid = await Newkid.findById(bid)
 
  res.render("editConfiremdamount", { donate, id, kid });
})

app.put("/editconfiremdamount/:id/:bid", async (req, res) => {
  const { id } = req.params;
  const { bid } = req.params;
  
  const kid = await Newkid.findById({bid});
  const donate = await Donate.findById(id);
 res.send(kid)
    const redusedAmount = kid.totalDonatedAmount - donate.confirmedAmount
  res.send(redusedAmount);
  const confirmedAmount = Number(await req.body.amount);
  

  // res.send(confirmedAmount);
  
  res.redirect(`/Kids`);
});


app.get("/search", (req, res) => {
  res.render("search");
});
app.get("/search/provience", (req, res) => {
  res.render("searchp");
});
app.post("/search/provience", async (req, res) => {
  const input = req.body.provience;
  const search = input.toLowerCase();

  console.log(search);

  let query = {
    $or: [{ provience: search }, { city: search }, { district: search }],
  };

  const kid = await Newkid.find(query);
  res.render("result", { kid });
});

app.get("/search/village", (req, res) => {
  res.render("searchv");
});
app.post("/search/village", async (req, res) => {
  const input = req.body.searchKey;
  const search = input.toLowerCase();

  console.log(search);

  let query = {
    $or: [{ village: search }],
  };

  const kid = await Newkid.find(query);
  res.render("result", { kid });
});

app.get("/search/street", (req, res) => {
  res.render("searchStLn");
});
app.post("/search/street", async (req, res) => {
  const input = req.body.searchKey;
  const search = input.toLowerCase();

  console.log(search);

  let query = {
    $or: [{ Street: search }, { line: search }],
  };

  const kid = await Newkid.find(query);
  res.render("result", { kid });
});

app.get("/search/mobilenumber", (req, res) => {
  res.render("searchMnPc");
});

app.post("/search/mobilenumber", async (req, res) => {
  const input = req.body.searchKey;

  console.log(input);

  let query = {
    $or: [{ mobileNumber: input }],
  };

  const kid = await Newkid.find(query);
  res.render("result", { kid });
});
app.get("/search/postcode", (req, res) => {
  res.render("searchpc");
});

app.post("/search/postcode", async (req, res) => {
  const input = req.body.searchKey;

  console.log(input);

  let query = {
    $or: [{ postCode: input }],
  };

  const kid = await Newkid.find(query);
  res.render("result", { kid });
});

app.get("/search/economylevel", (req, res) => {
  res.render("searchel");
});

app.post("/search/economylevel", async (req, res) => {
  const input = req.body.searchKey;

  console.log(input);

  const kid = await Newkid.find()
    .where("averageMonthlyIncomPerPerson")
    .lte(input)
    .exec();
  res.render("result", { kid });
});

app.get("/search/numberpoor", (req, res) => {
  res.render("searchNPP");
});
app.post("/search/numberpoor", async (req, res) => {
  const input = req.body.searchKey;

  console.log(input);

  const kid = await Newkid.find()
    .where("numberOfPoorPeople")
    .lte(input)
    .exec();
  res.render("result", { kid });
});

app.post("/api/login", async (req, res, next) => {
  await passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(404).send("Username or Password incorrect!");
    } else if (!user.activated) {
      return res.status(404).send("User is not Activated, pls Activate!");
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res
        .status(200)
        .send({ id: user._id, username: user.username, role: user.role });
    });
  })(req, res, next);
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

app.use((req, res) => {
  res.status(404).send(`<h1>The page is not defined</h1>`);
});
const port=process.env.PORT || 3000
app.listen(port, () => {
  console.log("BACKERY SERVER RUNNING!");
});
