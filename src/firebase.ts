import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAtie7TMd509O5qEbmr8tEd3DkjgUyTAkc",
  authDomain: "free-apps-creart.firebaseapp.com",
  databaseURL: "https://free-apps-creart.firebaseio.com",
  projectId: "free-apps-creart",
  storageBucket: "free-apps-creart.firebasestorage.app",
  messagingSenderId: "758813772513",
  appId: "1:758813772513:web:9da45cd53b3093932105a0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);
export default app;