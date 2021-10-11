const mongoose = require("mongoose");

const kidSchema = new mongoose.Schema({
  kidsname: {
    type: String,
    required: true,
  },

  sex: {
    type: String,
   
    required: true,
  },
  age: {
    type: Number,
    required: true,
  },

  donations: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donation",
    },
  ],
  totalDonatedAmount: {
    type: Number,
    default: 0,
  },
  creator: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    username: String,
  },
});

const Newkid = mongoose.model("Kids", kidSchema);

module.exports = Newkid;
