import mongoose from "mongoose";

let isConnected;

const connectDB = async () => {
  if (isConnected) {
    console.log("Using existing database connection");
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 20,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      // bufferCommands: false,
      // bufferMaxEntries: 0,
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 10000,
    });
    isConnected = conn.connections[0].readyState;
    console.log(`Server Connected to ${conn.connection.host}`.cyan.bold);
  } catch (error) {
    console.error(
      `Server Not Connected. Error: ${error.message}`.red.underline.bold
    );
  }
};

export default connectDB;
