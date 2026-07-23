import mongoose from "mongoose";

const photoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  images: {
    type: [{
      img: {
        type: String,
        required: true
      },
      text: {
        type: String,
        default: ""
      },
      url: {
        type: String,
        default: ""
      },
      albumPeriority: {
        type: Boolean,
        default: false
      },
      createdAt: {  // प्रत्येक इमेज के लिए अलग createdAt
        type: Date,
        default: Date.now
      }
    }],
    required: true,
    validate: [arrayLimit, '{PATH} exceeds the limit of 10']
  },
  status: {
    type: Boolean,
    default: true,
  },
  url: {
    type: String,
    default: "",
  },
  albumPeriority: {
    type: [Boolean],
    required: true,
  },
  periority: {
    type: Boolean,
    required: true,
    enum: [true, false],
  }
}, { 
  timestamps: true, // मुख्य डॉक्यूमेंट के लिए createdAt/updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// इमेज सरणी की लिमिट वैलिडेशन
function arrayLimit(val) {
  return val.length <= 10;
}

const Photo = mongoose.model("Photo", photoSchema);
export { Photo };