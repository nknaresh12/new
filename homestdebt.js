// ============================================
// FIREBASE IMPORTS
// ============================================

import {
    initializeApp
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
    getAuth,
    onAuthStateChanged,
    signOut
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {
    getFirestore,
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";



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

const app =
    initializeApp(firebaseConfig);


const auth =
    getAuth(app);


const db =
    getFirestore(app);


console.log(
    "Student dashboard Firebase connected!"
);



// ============================================
// GLOBAL VARIABLES
// ============================================

let allMarks = [];



// ============================================
// CHECK AUTHENTICATION
// ============================================

onAuthStateChanged(
    auth,
    async function(user) {

        // ========================================
        // NOT LOGGED IN
        // ========================================

        if (!user) {

            console.log(
                "No user logged in."
            );


            window.location.href =
                "./login.html";


            return;
        }



        // ========================================
        // LOGGED IN
        // ========================================

        console.log(
            "Logged in UID:",
            user.uid
        );


        try {

            await loadStudentProfile(
                user.uid
            );

        }

        catch(error) {

            console.error(
                "Dashboard error:",
                error
            );

            showError(
                "Unable to load student information."
            );

        }

    }
);



// ============================================
// LOAD STUDENT PROFILE
// ============================================

async function loadStudentProfile(uid) {

    console.log(
        "Loading student profile..."
    );


    // students/{uid}

    const studentRef =
        doc(
            db,
            "students",
            uid
        );


    const studentSnapshot =
        await getDoc(
            studentRef
        );



    // ========================================
    // PROFILE NOT FOUND
    // ========================================

    if (
        !studentSnapshot.exists()
    ) {

        console.error(
            "Student profile not found."
        );


        showError(
            "Student profile not found. Please contact your counsellor."
        );


        return;
    }



    // ========================================
    // GET DATA
    // ========================================

    const student =
        studentSnapshot.data();


    console.log(
        "Student:",
        student
    );



    // ========================================
    // DISPLAY PROFILE
    // ========================================

    document.getElementById(
        "studentName"
    ).textContent =
        student.studentName || "Student";


    document.getElementById(
        "profileName"
    ).textContent =
        student.studentName || "-";


    document.getElementById(
        "profileId"
    ).textContent =
        student.studentId || "-";


    document.getElementById(
        "profileEmail"
    ).textContent =
        student.email || "-";



    // ========================================
    // LOAD MARKS
    // ========================================

    await loadStudentMarks(
        student.studentId
    );

}



// ============================================
// LOAD MARKS
// ============================================

async function loadStudentMarks(
    studentId
) {

    console.log(
        "Searching marks for:",
        studentId
    );


    if (!studentId) {

        showError(
            "Student ID is missing."
        );

        return;
    }



    // ========================================
    // FIRESTORE QUERY
    // ========================================

    const marksQuery =
        query(
            collection(
                db,
                "marks"
            ),

            where(
                "studentId",
                "==",
                studentId
            )
        );


    const snapshot =
        await getDocs(
            marksQuery
        );



    // ========================================
    // CLEAR ARRAY
    // ========================================

    allMarks = [];



    // ========================================
    // STORE MARKS
    // ========================================

    snapshot.forEach(
        function(markDocument) {

            const data =
                markDocument.data();


            allMarks.push({

                id:
                    markDocument.id,

                ...data

            });

        }
    );


    console.log(
        "Marks found:",
        allMarks
    );



    // ========================================
    // SORT
    // ========================================

    allMarks.sort(
        function(a, b) {

            const semesterDifference =
                Number(a.semester || 0) -
                Number(b.semester || 0);


            if (
                semesterDifference !== 0
            ) {

                return semesterDifference;

            }


            return String(
                a.exam || ""
            ).localeCompare(
                String(
                    b.exam || ""
                )
            );

        }
    );



    // ========================================
    // UPDATE STATISTICS
    // ========================================

    updateStatistics();



    // ========================================
    // DISPLAY TABLE
    // ========================================

    renderMarks(
        allMarks
    );

}



// ============================================
// UPDATE STATISTICS
// ============================================

function updateStatistics() {

    let obtained = 0;

    let maximum = 0;


    const subjects =
        new Set();


    const exams =
        new Set();



    allMarks.forEach(
        function(mark) {

            obtained +=
                Number(
                    mark.marks || 0
                );


            maximum +=
                Number(
                    mark.maxMarks || 0
                );


            if (mark.subject) {

                subjects.add(
                    mark.subject
                );

            }


            if (mark.examId) {

                exams.add(
                    mark.examId
                );

            }

            else {

                exams.add(
                    `${mark.semester}_${mark.exam}`
                );

            }

        }
    );



    let average = 0;


    if (maximum > 0) {

        average =
            (
                obtained /
                maximum
            ) * 100;

    }



    document.getElementById(
        "totalExams"
    ).textContent =
        exams.size;


    document.getElementById(
        "totalSubjects"
    ).textContent =
        subjects.size;


    document.getElementById(
        "averagePercentage"
    ).textContent =
        average.toFixed(1) + "%";


    document.getElementById(
        "totalMarks"
    ).textContent =
        `${obtained}/${maximum}`;

}



// ============================================
// RENDER MARKS
// ============================================

function renderMarks(
    marks
) {

    const table =
        document.getElementById(
            "marksTableBody"
        );


    if (!table) {

        return;
    }



    // ========================================
    // NO MARKS
    // ========================================

    if (
        marks.length === 0
    ) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="empty"
                >

                    No marks have been uploaded yet.

                </td>

            </tr>

        `;

        return;
    }



    // ========================================
    // CREATE ROWS
    // ========================================

    table.innerHTML =
        marks.map(
            function(mark) {

                return `

                    <tr>

                        <td>
                            Semester
                            ${mark.semester || "-"}
                        </td>

                        <td>
                            ${mark.exam || "-"}
                        </td>

                        <td>
                            ${mark.subject || "-"}
                        </td>

                        <td>
                            ${mark.marks || 0}
                            /
                            ${mark.maxMarks || 50}
                        </td>

                        <td>
                            ${mark.percentage || 0}%
                        </td>

                    </tr>

                `;

            }
        ).join("");

}



// ============================================
// SEMESTER FILTER
// ============================================

const semesterFilter =
    document.getElementById(
        "semesterFilter"
    );


semesterFilter.addEventListener(
    "change",
    function() {

        const selected =
            semesterFilter.value;


        // All semesters

        if (
            selected === "all"
        ) {

            renderMarks(
                allMarks
            );

            return;
        }



        // Selected semester

        const filtered =
            allMarks.filter(
                function(mark) {

                    return String(
                        mark.semester
                    ) === selected;

                }
            );


        renderMarks(
            filtered
        );

    }
);



// ============================================
// LOGOUT
// ============================================

const logoutButton =
    document.getElementById(
        "logoutButton"
    );


logoutButton.addEventListener(
    "click",
    async function() {

        try {

            await signOut(
                auth
            );


            console.log(
                "Logged out."
            );


            window.location.href =
                "./login.html";

        }

        catch(error) {

            console.error(
                "Logout error:",
                error
            );

        }

    }
);



// ============================================
// ERROR
// ============================================

function showError(
    message
) {

    const table =
        document.getElementById(
            "marksTableBody"
        );


    if (table) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="empty"
                >

                    ${message}

                </td>

            </tr>

        `;

    }

}