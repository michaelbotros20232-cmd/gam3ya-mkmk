import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 👇 حط هنا الكونفيج بتاع مشروع Firebase الخاص بيك
// (Project settings > General > Your apps > SDK setup and configuration)
const firebaseConfig = {
  apiKey: 'AIzaSyC4-GhJ28bMxwdJuJqozZgwD5YIw54T-ac',
  authDomain: 'gam3yaa-mkmk.firebaseapp.com',
  projectId: 'gam3yaa-mkmk',
  storageBucket: 'gam3yaa-mkmk.firebasestorage.app',
  messagingSenderId: '731858763035',
  appId: '1:731858763035:web:8be1ff682685e7e4db27be',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
