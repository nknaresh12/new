// ==========================================
// FIREBASE
// ==========================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// ==========================================
// FIREBASE CONFIG
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyByRLQj6i2c2GhM21-cmRkSISbIVbfyZQU",
    authDomain: "student-progress-tracker-33064.firebaseapp.com",
    projectId: "student-progress-tracker-33064",
    storageBucket: "student-progress-tracker-33064.firebasestorage.app",
    messagingSenderId: "549690484739",
    appId: "1:549690484739:web:903b227ae9d9a238ae8636",
    measurementId: "G-30WQXGEKT8"
};


// ==========================================
// INITIALIZE FIREBASE
// ==========================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);


// ==========================================
// STUDENT LOGIN
// ==========================================

const loginForm =
    document.getElementById("loginForm");

const loginButton =
    document.getElementById("loginButton");

const message =
    document.getElementById("message");


loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;


    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";


    try {

        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user = userCredential.user;


        localStorage.setItem(
            "firebaseUid",
            user.uid
        );

        localStorage.setItem(
            "studentEmail",
            user.email
        );


        message.textContent =
            "Login successful!";

        message.className =
            "success";

        message.style.display =
            "block";


        setTimeout(() => {

            window.location.href =
                "./index.html";

        }, 500);


    } catch (error) {

        console.error(error);


        message.style.display =
            "block";

        message.className =
            "error";


        message.textContent =
            "Incorrect Gmail or password.";


        loginButton.disabled = false;

        loginButton.textContent =
            "Login";

    }

});


// ==========================================
// ADMIN LOGIN
// ==========================================

const adminButton =
    document.getElementById("adminButton");

const adminLogin =
    document.getElementById("adminLogin");

const adminForm =
    document.getElementById("adminForm");

const adminMessage =
    document.getElementById("adminMessage");


// Check that elements exist

console.log("Admin button:", adminButton);
console.log("Admin login box:", adminLogin);


// ==========================================
// OPEN ADMIN LOGIN
// ==========================================

adminButton.addEventListener("click", () => {

    console.log("Admin button clicked!");

    adminLogin.classList.toggle("show");

});


// ==========================================
// ADMIN CREDENTIALS
// ==========================================

const ADMIN_EMAIL =
    "nknaresh2008@gmail.com";

const ADMIN_PASSWORD =
    "123456";


// ==========================================
// ADMIN FORM
// ==========================================

adminForm.addEventListener("submit", (event) => {

    event.preventDefault();


    const email =
        document
            .getElementById("adminEmail")
            .value
            .trim()
            .toLowerCase();


    const password =
        document
            .getElementById("adminPassword")
            .value;


    // ======================================
    // CHECK ADMIN LOGIN
    // ======================================

    if (
        email === ADMIN_EMAIL &&
        password === ADMIN_PASSWORD
    ) {

        adminMessage.textContent =
            "Admin login successful!";

        adminMessage.className =
            "admin-message success";


        setTimeout(() => {

            window.location.href =
                "./counsellor.html";

        }, 500);

    }

    else {

        adminMessage.textContent =
            "Incorrect admin email or password.";

        adminMessage.className =
            "admin-message error";

    }

});