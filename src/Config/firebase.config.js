// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app"
import { getStorage } from "firebase/storage"

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD4mIxvMtxAYCXeONwKygm8UhEfL3id-qY",
  authDomain: "loksatya-afbdb.firebaseapp.com",
  projectId: "loksatya-afbdb",
  storageBucket: "loksatya-afbdb",  //gs://loksatya_bucket
  messagingSenderId: "278870811035",
  appId: "1:278870811035:web:033a51593914b699e5413e",
  measurementId: "G-3ESNRNFQKC"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const Storage = getStorage(app)

export { Storage } 