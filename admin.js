// ============================================
// STUDENTTRACK ADMIN CONTROL
// ============================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    getAuth,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


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
// FIREBASE INITIALIZATION
// ============================================

const app =
    initializeApp(firebaseConfig);


const db =
    getFirestore(app);


// Secondary Auth app.
// This prevents creating a counsellor account
// from logging out the Admin.

const counsellorApp =
    initializeApp(
        firebaseConfig,
        "counsellorCreationApp"
    );


const counsellorAuth =
    getAuth(counsellorApp);


// ============================================
// ADMIN CREDENTIALS
// ============================================

const ADMIN_EMAIL =
    "admin@gmail.com";

const ADMIN_PASSWORD =
    "admin";


// ============================================
// HTML ELEMENTS
// ============================================

const loginPage =
    document.getElementById("loginPage");

const dashboardPage =
    document.getElementById("dashboardPage");

const loginForm =
    document.getElementById("adminLoginForm");

const loginMessage =
    document.getElementById("loginMessage");

const counsellorForm =
    document.getElementById("counsellorForm");

const formMessage =
    document.getElementById("formMessage");

const counsellorTable =
    document.getElementById("counsellorTable");

const totalCounsellors =
    document.getElementById("totalCounsellors");

const activeCounsellors =
    document.getElementById("activeCounsellors");

const pendingCounsellors =
    document.getElementById("pendingCounsellors");

const logoutButton =
    document.getElementById("logoutButton");


// ============================================
// ADMIN LOGIN CHECK
// ============================================

if (
    sessionStorage.getItem("adminLoggedIn")
    === "true"
) {

    showDashboard();

}


// ============================================
// LOGIN
// ============================================

loginForm.addEventListener(
    "submit",
    function (event) {

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


        if (
            email === ADMIN_EMAIL &&
            password === ADMIN_PASSWORD
        ) {

            sessionStorage.setItem(
                "adminLoggedIn",
                "true"
            );


            sessionStorage.setItem(
                "adminEmail",
                ADMIN_EMAIL
            );


            showDashboard();

        }

        else {

            loginMessage.textContent =
                "Incorrect admin Gmail or password.";

            loginMessage.style.color =
                "#dc2626";

        }

    }
);


// ============================================
// SHOW DASHBOARD
// ============================================

function showDashboard() {

    loginPage.classList.add("hidden");

    dashboardPage.classList.remove("hidden");

    loadCounsellors();

}


// ============================================
// ADD COUNSELLOR
// ============================================

counsellorForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const name =
            document
                .getElementById("counsellorName")
                .value
                .trim();


        const email =
            document
                .getElementById("counsellorEmail")
                .value
                .trim()
                .toLowerCase();


        const password =
            document
                .getElementById("counsellorPassword")
                .value;


        if (
            password.length < 6
        ) {

            showFormMessage(
                "Password must contain at least 6 characters.",
                "error"
            );

            return;

        }


        const button =
            document.getElementById(
                "addCounsellorButton"
            );


        button.disabled = true;

        button.textContent =
            "Creating...";


        try {

            // =================================
            // CREATE FIREBASE AUTH ACCOUNT
            // =================================

            const result =
                await createUserWithEmailAndPassword(
                    counsellorAuth,
                    email,
                    password
                );


            const user =
                result.user;


            // =================================
            // CREATE FIRESTORE PROFILE
            // =================================

            await setDoc(
                doc(
                    db,
                    "counsellors",
                    user.uid
                ),
                {

                    uid:
                        user.uid,

                    name:
                        name,

                    email:
                        email,

                    // IMPORTANT
                    // New counsellors are NOT
                    // allowed immediately.

                    active:
                        false,

                    createdAt:
                        serverTimestamp()

                }
            );


            showFormMessage(
                "Counsellor created successfully. Approve the account to give access.",
                "success"
            );


            counsellorForm.reset();


            await loadCounsellors();

        }

        catch (error) {

            console.error(
                "Counsellor creation error:",
                error
            );


            let errorMessage =
                "Unable to create counsellor.";


            switch (error.code) {

                case "auth/email-already-in-use":

                    errorMessage =
                        "This Gmail already has a Firebase account.";

                    break;


                case "auth/invalid-email":

                    errorMessage =
                        "Please enter a valid Gmail address.";

                    break;


                case "auth/weak-password":

                    errorMessage =
                        "Password must contain at least 6 characters.";

                    break;


                default:

                    errorMessage =
                        error.message;

            }


            showFormMessage(
                errorMessage,
                "error"
            );

        }


        button.disabled = false;

        button.textContent =
            "+ Add Counsellor";

    }
);


// ============================================
// LOAD COUNSELLORS
// ============================================

async function loadCounsellors() {

    counsellorTable.innerHTML = `

        <tr>

            <td
                colspan="4"
                class="empty-row"
            >
                Loading counsellors...
            </td>

        </tr>

    `;


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "counsellors"
                )
            );


        totalCounsellors.textContent =
            snapshot.size;


        let active = 0;

        let pending = 0;


        counsellorTable.innerHTML = "";


        if (snapshot.empty) {

            counsellorTable.innerHTML = `

                <tr>

                    <td
                        colspan="4"
                        class="empty-row"
                    >
                        No counsellors added yet.
                    </td>

                </tr>

            `;

        }


        snapshot.forEach(
            function (documentSnapshot) {

                const data =
                    documentSnapshot.data();


                const uid =
                    documentSnapshot.id;


                if (
                    data.active === true
                ) {

                    active++;

                }

                else {

                    pending++;

                }


                createCounsellorRow(
                    uid,
                    data
                );

            }
        );


        activeCounsellors.textContent =
            active;


        pendingCounsellors.textContent =
            pending;

    }

    catch (error) {

        console.error(
            "Error loading counsellors:",
            error
        );


        counsellorTable.innerHTML = `

            <tr>

                <td
                    colspan="4"
                    class="empty-row"
                >
                    Failed to load counsellors.
                </td>

            </tr>

        `;

    }

}


// ============================================
// CREATE TABLE ROW
// ============================================

function createCounsellorRow(
    uid,
    data
) {

    const row =
        document.createElement("tr");


    let statusHTML;


    let actionHTML;


    // ========================================
    // ACTIVE
    // ========================================

    if (data.active === true) {

        statusHTML = `
            <span class="status active">
                ACTIVE
            </span>
        `;


        actionHTML = `

            <button
                class="access-button disable-button"
                data-action="disable"
                data-id="${uid}"
            >
                Disable
            </button>

            <button
                class="access-button remove-button"
                data-action="remove"
                data-id="${uid}"
            >
                Remove
            </button>

        `;

    }


    // ========================================
    // PENDING / DISABLED
    // ========================================

    else {

        statusHTML = `
            <span class="status pending">
                ACCESS OFF
            </span>
        `;


        actionHTML = `

            <button
                class="access-button approve-button"
                data-action="approve"
                data-id="${uid}"
            >
                Give Access
            </button>

            <button
                class="access-button remove-button"
                data-action="remove"
                data-id="${uid}"
            >
                Remove
            </button>

        `;

    }


    row.innerHTML = `

        <td>

            <div class="counsellor-name">

                ${escapeHTML(
                    data.name || "Unknown"
                )}

            </div>

        </td>


        <td>

            <div class="counsellor-email">

                ${escapeHTML(
                    data.email || ""
                )}

            </div>

        </td>


        <td>

            ${statusHTML}

        </td>


        <td>

            ${actionHTML}

        </td>

    `;


    counsellorTable.appendChild(row);

}


// ============================================
// BUTTON ACTIONS
// ============================================

counsellorTable.addEventListener(
    "click",
    async function (event) {

        const button =
            event.target.closest(
                "[data-action]"
            );


        if (!button) {

            return;

        }


        const action =
            button.dataset.action;


        const uid =
            button.dataset.id;


        try {

            // =================================
            // GIVE ACCESS
            // =================================

            if (
                action === "approve"
            ) {

                await updateDoc(
                    doc(
                        db,
                        "counsellors",
                        uid
                    ),
                    {
                        active: true
                    }
                );

            }


            // =================================
            // DISABLE ACCESS
            // =================================

            else if (
                action === "disable"
            ) {

                await updateDoc(
                    doc(
                        db,
                        "counsellors",
                        uid
                    ),
                    {
                        active: false
                    }
                );

            }


            // =================================
            // REMOVE
            // =================================

            else if (
                action === "remove"
            ) {

                const confirmed =
                    confirm(
                        "Remove this counsellor's access?"
                    );


                if (!confirmed) {

                    return;

                }


                await deleteDoc(
                    doc(
                        db,
                        "counsellors",
                        uid
                    )
                );

            }


            await loadCounsellors();

        }

        catch (error) {

            console.error(
                "Access control error:",
                error
            );


            alert(
                "Unable to update counsellor access."
            );

        }

    }
);


// ============================================
// LOGOUT
// ============================================

logoutButton.addEventListener(
    "click",
    function () {

        sessionStorage.removeItem(
            "adminLoggedIn"
        );

        sessionStorage.removeItem(
            "adminEmail"
        );


        window.location.href =
            "./index.html";

    }
);


// ============================================
// FORM MESSAGE
// ============================================

function showFormMessage(
    text,
    type
) {

    formMessage.textContent =
        text;


    if (type === "success") {

        formMessage.style.color =
            "#16a34a";

    }

    else {

        formMessage.style.color =
            "#dc2626";

    }

}


// ============================================
// ESCAPE HTML
// ============================================

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}
