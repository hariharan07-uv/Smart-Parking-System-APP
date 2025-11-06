// firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAkgFOZXlNs1CIkhZjq6fvStapRR-kNgrU",
  authDomain: "car-parking-2b5ba.firebaseapp.com",
  databaseURL: "https://car-parking-2b5ba-default-rtdb.firebaseio.com",
  projectId: "car-parking-2b5ba",
  storageBucket: "car-parking-2b5ba.appspot.comt",
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
