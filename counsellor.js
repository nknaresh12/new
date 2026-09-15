import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
    getAuth,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================
// FIREBASE CONFIG
// ============================================

const firebaseConfig = {

    apiKey:
        "AIzaSyByRLQj6i2c2GhM21-cmRkSISbIVbfyZQU",

    authDomain:
        "student-progress-tracker-33064.firebaseapp.com",

    projectId:
        "student-progress-tracker-33064",

    storageBucket:
        "student-progress-tracker-33064.firebasestorage.app",

    messagingSenderId:
        "549690484739",

    appId:
        "1:549690484739:web:903b227ae9d9a238ae8636",

    measurementId:
        "G-30WQXGEKT8"
};


// ============================================
// INITIALIZE FIREBASE
// ============================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


// ============================================
// HTML ELEMENTS
// ============================================

const loginForm =
    document.getElementById("loginForm");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const loginButton =
    document.getElementById("loginButton");

const message =
    document.getElementById("message");

const togglePassword =
    document.getElementById("togglePassword");


// ============================================
// PASSWORD SHOW / HIDE
// ============================================

if (togglePassword) {

    togglePassword.addEventListener(
        "click",
        () => {

            if (
                passwordInput.type ===
                "password"
            ) {

                passwordInput.type =
                    "text";

                togglePassword.textContent =
                    "Hide";

            } else {

                passwordInput.type =
                    "password";

                togglePassword.textContent =
                    "Show";

            }

        }
    );
}


// ============================================
// MESSAGE FUNCTION
// ============================================

function showMessage(
    text,
    type = "error"
) {

    message.textContent = text;


    if (type === "success") {

        message.style.color =
            "#16a34a";

    } else {

        message.style.color =
            "#dc2626";

    }
}


// ============================================
// RESET BUTTON
// ============================================

function resetButton() {

    loginButton.disabled = false;

    loginButton.textContent =
        "Login";
}


// ============================================
// LOGIN
// ============================================

loginForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const email =
            emailInput.value
                .trim()
                .toLowerCase();


        const password =
            passwordInput.value;


        if (!email || !password) {

            showMessage(
                "Please enter Gmail and password."
            );

            return;
        }


        loginButton.disabled = true;

        loginButton.textContent =
            "Checking...";


        try {

            // =================================
            // STEP 1
            // FIREBASE LOGIN
            // =================================

            const result =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            const user =
                result.user;


            console.log(
                "Firebase login successful"
            );

            console.log(
                "Counsellor UID:",
                user.uid
            );


            // =================================
            // STEP 2
            // CHECK FIRESTORE
            // =================================

            const counsellorRef =
                doc(
                    db,
                    "counsellors",
                    user.uid
                );


            const counsellorSnap =
                await getDoc(
                    counsellorRef
                );


            // =================================
            // NO COUNSELLOR PROFILE
            // =================================

            if (
                !counsellorSnap.exists()
            ) {

                await signOut(auth);


                showMessage(
                    "This Gmail has not been added by the administrator."
                );


                resetButton();

                return;
            }


            // =================================
            // GET COUNSELLOR DATA
            // =================================

            const counsellor =
                counsellorSnap.data();


            console.log(
                "Counsellor data:",
                counsellor
            );


            // =================================
            // CHECK ADMIN APPROVAL
            // =================================

            if (
                counsellor.active !== true
            ) {

                await signOut(auth);


                showMessage(
                    "Access denied. The administrator has not approved this Gmail yet."
                );


                resetButton();

                return;
            }


            // =================================
            // ACCESS APPROVED
            // =================================

            showMessage(
                "Access approved. Opening dashboard...",
                "success"
            );


            // =================================
            // GO TO DASHBOARD
            // =================================

            setTimeout(
                () => {

                    window.location.href =
                        "./counsellor-dashboard.html";

                },
                700
            );

        }


        catch (error) {

            console.error(
                "COUNSELLOR LOGIN ERROR:",
                error
            );


            let errorMessage =
                "Login failed.";


            switch (error.code) {

                case "auth/invalid-credential":

                    errorMessage =
                        "Invalid Gmail or password.";

                    break;


                case "auth/user-not-found":

                    errorMessage =
                        "This Gmail is not registered in Firebase.";

                    break;


                case "auth/wrong-password":

                    errorMessage =
                        "Incorrect password.";

                    break;


                case "auth/invalid-email":

                    errorMessage =
                        "Please enter a valid Gmail address.";

                    break;


                case "auth/too-many-requests":

                    errorMessage =
                        "Too many login attempts. Please try again later.";

                    break;


                case "auth/user-disabled":

                    errorMessage =
                        "This Firebase account has been disabled.";

                    break;


                case "auth/operation-not-allowed":

                    errorMessage =
                        "Email/password authentication is disabled in Firebase.";

                    break;


                default:

                    errorMessage =
                        "Firebase error: " +
                        error.code;
            }


            showMessage(
                errorMessage
            );


            resetButton();

        }

    }
);
