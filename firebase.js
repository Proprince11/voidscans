import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"; // <-- NEW

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCN90gGJYotvIFof1M7zxSSIdWzjWjZdB0",
  authDomain: "voidscans-6c66b.firebaseapp.com",
  projectId: "voidscans-6c66b",
  storageBucket: "voidscans-6c66b.firebasestorage.app",
  messagingSenderId: "1075674977587",
  appId: "1:1075674977587:web:f306a9e3dd0de2ec5e5a46"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and Auth, then export them
export const db = getFirestore(app);
export const auth = getAuth(app); // <-- NEW