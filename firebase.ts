import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

// ==========================================================================================
// IMPORTANT: ACTION REQUIRED
// ==========================================================================================
// 1. Create a Firebase project at https://console.firebase.google.com/
// 2. In your project, go to Project settings > General.
// 3. In the "Your apps" section, click the web icon (</>) to create a new web app.
// 4. After creating the app, find the "Firebase SDK snippet" and select "Config".
// 5. Copy the `firebaseConfig` object and paste it below, replacing the placeholder values.
// ==========================================================================================

const firebaseConfig = {
    apiKey: "REPLACE_WITH_YOUR_API_KEY",
    authDomain: "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
    storageBucket: "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
    appId: "REPLACE_WITH_YOUR_APP_ID"
};

// ==========================================================================================
// IMPORTANT: ACTION REQUIRED
// ==========================================================================================
// For this app to work, you must also set up Firestore security rules.
// For development, you can use the following insecure rules in your Firebase console
// under Firestore Database > Rules:
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /{document=**} {
//       allow read, write: if true;
//     }
//   }
// }
//
// WARNING: These rules are not secure and should only be used for development.
// For production, you should implement more secure rules.
// ==========================================================================================


// ==========================================================================================
// ORGANIZER SETUP (ACTION REQUIRED)
// ==========================================================================================
// To enable the "Create Quiz" functionality for specific users, you must set up
// an 'organizers' collection in your Firestore database.
//
// 1. Go to your Firestore Database in the Firebase Console.
// 2. Click "+ Start collection".
// 3. Set the Collection ID to "organizers".
// 4. Create a document for each organizer. The Document ID should be the organizer's username.
//    For example, to add 'sai.dabbiru':
//    - Document ID: sai.dabbiru
//    - You can leave the fields empty or add a 'name' field, e.g., { name: "Sai Dabbiru" }
// 5. Repeat for all organizers (e.g., 'arpan.patro', 'shubham.gondane').
//
// The app will check against this collection to grant access to the quiz creation page.
// ==========================================================================================


// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const db = firebase.firestore();
export default firebase;