/* =====================================================
   FIREBASE
===================================================== */

import {
    initializeApp
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    setDoc,
    doc,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


import {
    getAuth,
    createUserWithEmailAndPassword
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


/* =====================================================
   FIREBASE CONFIG
===================================================== */

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


/* =====================================================
   INITIALIZE FIREBASE
===================================================== */

const app =
    initializeApp(firebaseConfig);


const db =
    getFirestore(app);


const auth =
    getAuth(app);


/*
    SECOND AUTH INSTANCE

    This prevents creating a student account
    from logging the counsellor out.
*/

const studentApp =
    initializeApp(
        firebaseConfig,
        "studentAccountApp"
    );


const studentAuth =
    getAuth(studentApp);


console.log(
    "Firebase connected!"
);



/* =====================================================
   GLOBAL DATA
===================================================== */

let allStudents = [];

let allMarks = [];

let selectedStudent = null;

let studentToDelete = null;


/* =====================================================
   CREATE STUDENT ACCOUNT
===================================================== */

const studentAccountForm =
    document.getElementById(
        "studentAccountForm"
    );


if (studentAccountForm) {

    studentAccountForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const name =
                document
                    .getElementById(
                        "accountStudentName"
                    )
                    .value
                    .trim();


            const studentId =
                document
                    .getElementById(
                        "accountStudentId"
                    )
                    .value
                    .trim()
                    .toUpperCase();


            const email =
                document
                    .getElementById(
                        "accountEmail"
                    )
                    .value
                    .trim()
                    .toLowerCase();


            const password =
                document
                    .getElementById(
                        "accountPassword"
                    )
                    .value;


            const button =
                document.getElementById(
                    "createStudentButton"
                );


            const message =
                document.getElementById(
                    "studentAccountMessage"
                );


            if (
                !name ||
                !studentId ||
                !email ||
                !password
            ) {

                showMessage(
                    message,
                    "Please fill all fields.",
                    "error"
                );

                return;
            }


            try {

                button.disabled = true;

                button.textContent =
                    "Creating...";


                /*
                    CREATE FIREBASE AUTH ACCOUNT
                */

                const result =
                    await createUserWithEmailAndPassword(
                        studentAuth,
                        email,
                        password
                    );


                const user =
                    result.user;


                /*
                    CREATE STUDENT PROFILE
                */

                await setDoc(
                    doc(
                        db,
                        "students",
                        user.uid
                    ),
                    {

                        uid:
                            user.uid,

                        studentId:
                            studentId,

                        studentName:
                            name,

                        email:
                            email,

                        createdAt:
                            serverTimestamp()

                    }
                );


                showMessage(
                    message,
                    "Student account created successfully!",
                    "success"
                );


                studentAccountForm.reset();


                /*
                    REFRESH STUDENT CARDS
                */

                await loadDashboard();


            } catch (error) {

                console.error(
                    "Create student error:",
                    error
                );


                let text =
                    error.message;


                if (
                    error.code ===
                    "auth/email-already-in-use"
                ) {

                    text =
                        "This Gmail is already registered.";

                } else if (
                    error.code ===
                    "auth/operation-not-allowed"
                ) {

                    text =
                        "Enable Email/Password Authentication in Firebase.";

                } else if (
                    error.code ===
                    "auth/weak-password"
                ) {

                    text =
                        "Password must contain at least 6 characters.";

                }


                showMessage(
                    message,
                    text,
                    "error"
                );


            } finally {

                button.disabled = false;

                button.textContent =
                    "Create Student Account";

            }

        }
    );

}


/* =====================================================
   BULK MARK UPLOAD
===================================================== */

const bulkMarksForm =
    document.getElementById(
        "bulkMarksForm"
    );


if (bulkMarksForm) {

    bulkMarksForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const studentId =
                document
                    .getElementById(
                        "bulkStudentId"
                    )
                    .value
                    .trim()
                    .toUpperCase();


            const studentName =
                document
                    .getElementById(
                        "bulkStudentName"
                    )
                    .value
                    .trim();


            const semester =
                document.getElementById(
                    "semester"
                ).value;


            const modelExam =
                document.getElementById(
                    "modelExam"
                ).value;


            const message =
                document.getElementById(
                    "bulkMarksMessage"
                );


            const button =
                document.getElementById(
                    "bulkUploadButton"
                );


            if (
                !studentId ||
                !studentName ||
                !semester ||
                !modelExam
            ) {

                showMessage(
                    message,
                    "Please fill all student and examination details.",
                    "error"
                );

                return;
            }


            const markInputs =
                document.querySelectorAll(
                    ".subject-mark"
                );


            const subjects = [];


            /*
                VALIDATE ALL SIX SUBJECTS
            */

            for (
                const input
                of markInputs
            ) {

                const subject =
                    input.dataset.subject;


                const marks =
                    Number(input.value);


                const maxMarks =
                    50;


                if (
                    input.value === "" ||
                    isNaN(marks)
                ) {

                    showMessage(
                        message,
                        `Enter marks for ${subject}.`,
                        "error"
                    );

                    return;
                }


                if (
                    marks < 0 ||
                    marks > maxMarks
                ) {

                    showMessage(
                        message,
                        `${subject}: Marks must be between 0 and 50.`,
                        "error"
                    );

                    return;
                }


                const percentage =
                    Number(
                        (
                            marks /
                            maxMarks *
                            100
                        ).toFixed(2)
                    );


                subjects.push({

                    subject:
                        subject,

                    marks:
                        marks,

                    maxMarks:
                        maxMarks,

                    percentage:
                        percentage

                });

            }


            const examId =
                `${studentId}_SEM${semester}_${modelExam.replaceAll(" ", "_")}`;


            try {

                button.disabled = true;

                button.textContent =
                    "Uploading 6 Subjects...";


                /*
                    CREATE SIX FIRESTORE DOCUMENTS
                */

                for (
                    const subjectData
                    of subjects
                ) {

                    await addDoc(
                        collection(
                            db,
                            "marks"
                        ),
                        {

                            studentId:
                                studentId,

                            studentName:
                                studentName,

                            semester:
                                Number(semester),

                            exam:
                                modelExam,

                            examId:
                                examId,

                            subject:
                                subjectData.subject,

                            marks:
                                subjectData.marks,

                            maxMarks:
                                subjectData.maxMarks,

                            percentage:
                                subjectData.percentage,

                            uploadedAt:
                                serverTimestamp()

                        }
                    );

                }


                showMessage(
                    message,
                    `Successfully uploaded all 6 subject marks for Semester ${semester} - ${modelExam}.`,
                    "success"
                );


                bulkMarksForm.reset();


                /*
                    REFRESH DASHBOARD
                */

                await loadDashboard();


            } catch (error) {

                console.error(
                    "Bulk upload error:",
                    error
                );


                showMessage(
                    message,
                    "Failed to upload marks. Check the console.",
                    "error"
                );


            } finally {

                button.disabled = false;

                button.textContent =
                    "Upload All 6 Subject Marks";

            }

        }
    );

}


/* =====================================================
   LOAD DASHBOARD
===================================================== */

async function loadDashboard() {

    try {

        /*
            GET STUDENTS
        */

        const studentsSnapshot =
            await getDocs(
                collection(
                    db,
                    "students"
                )
            );


        allStudents = [];


        studentsSnapshot.forEach(
            function(studentDocument) {

                allStudents.push({

                    uid:
                        studentDocument.id,

                    ...studentDocument.data()

                });

            }
        );


        /*
            GET ALL MARKS
        */

        const marksSnapshot =
            await getDocs(
                collection(
                    db,
                    "marks"
                )
            );


        allMarks = [];


        marksSnapshot.forEach(
            function(markDocument) {

                allMarks.push({

                    id:
                        markDocument.id,

                    ...markDocument.data()

                });

            }
        );


        /*
            SORT STUDENTS
        */

        allStudents.sort(
            function(a, b) {

                return String(
                    a.studentName || ""
                ).localeCompare(
                    String(
                        b.studentName || ""
                    )
                );

            }
        );


        /*
            UPDATE STATS
        */

        updateDashboardStats();


        /*
            RENDER STUDENT CARDS
        */

        renderStudentCards();


        /*
            RENDER RECENT MARKS
        */

        renderRecentMarks();


        console.log(
            "Students:",
            allStudents.length
        );


        console.log(
            "Marks:",
            allMarks.length
        );


    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );


        const cards =
            document.getElementById(
                "studentCards"
            );


        if (cards) {

            cards.innerHTML = `

                <div class="empty-students">

                    <div class="empty-students-icon">
                        ⚠️
                    </div>

                    <p>
                        Unable to load students.
                    </p>

                </div>

            `;

        }

    }

}


/* =====================================================
   DASHBOARD STATS
===================================================== */

function updateDashboardStats() {

    const totalStudents =
        document.getElementById(
            "totalStudents"
        );


    const totalMarks =
        document.getElementById(
            "totalMarks"
        );


    const averagePercentage =
        document.getElementById(
            "averagePercentage"
        );


    if (totalStudents) {

        totalStudents.textContent =
            allStudents.length;

    }


    if (totalMarks) {

        totalMarks.textContent =
            allMarks.length;

    }


    let totalMarksObtained = 0;

    let totalMaximumMarks = 0;


    allMarks.forEach(
        function(mark) {

            totalMarksObtained +=
                Number(
                    mark.marks || 0
                );


            totalMaximumMarks +=
                Number(
                    mark.maxMarks || 0
                );

        }
    );


    const average =
        totalMaximumMarks > 0

            ? (
                totalMarksObtained /
                totalMaximumMarks *
                100
            )

            : 0;


    if (averagePercentage) {

        averagePercentage.textContent =
            average.toFixed(1) + "%";

    }

}


/* =====================================================
   RENDER STUDENT CARDS
===================================================== */

function renderStudentCards() {

    const container =
        document.getElementById(
            "studentCards"
        );


    const count =
        document.getElementById(
            "studentCardCount"
        );


    if (!container) return;


    if (count) {

        count.textContent =
            allStudents.length;

    }


    if (
        allStudents.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-students">

                <div class="empty-students-icon">
                    🎓
                </div>

                <p>
                    No students have been created yet.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML =
        allStudents
            .map(
                function(student) {

                    return createStudentCard(
                        student
                    );

                }
            )
            .join("");


    /*
        VIEW MARKS EVENTS
    */

    container
        .querySelectorAll(
            ".view-marks-button"
        )
        .forEach(
            function(button) {

                button.addEventListener(
                    "click",
                    function() {

                        const uid =
                            button.dataset.uid;

                        openMarksModal(
                            uid
                        );

                    }
                );

            }
        );


    /*
        DELETE EVENTS
    */

    container
        .querySelectorAll(
            ".delete-button"
        )
        .forEach(
            function(button) {

                button.addEventListener(
                    "click",
                    function() {

                        const uid =
                            button.dataset.uid;

                        openDeleteModal(
                            uid
                        );

                    }
                );

            }
        );

}


/* =====================================================
   CREATE STUDENT CARD HTML
===================================================== */

function createStudentCard(student) {

    const marksCount =
        allMarks.filter(
            function(mark) {

                return (
                    String(mark.studentId)
                    .toUpperCase()
                    ===
                    String(student.studentId)
                    .toUpperCase()
                );

            }
        ).length;


    const name =
        student.studentName ||
        "Unknown Student";


    const studentId =
        student.studentId ||
        "-";


    const email =
        student.email ||
        "-";


    const initials =
        getInitials(name);


    return `

        <div class="student-card">

            <div class="student-card-top">

                <div class="student-avatar">

                    ${escapeHTML(initials)}

                </div>


                <div>

                    <h3>
                        ${escapeHTML(name)}
                    </h3>

                    <div class="student-id">

                        ${escapeHTML(studentId)}

                    </div>

                    <div class="mark-count">

                        ${marksCount}
                        Mark Entries

                    </div>

                </div>

            </div>


            <div class="student-details">

                <div class="student-detail email">

                    ✉️

                    <strong>
                        Email:
                    </strong>

                    ${escapeHTML(email)}

                </div>


                <div class="student-detail">

                    📝

                    <strong>
                        Marks:
                    </strong>

                    ${marksCount} entries

                </div>

            </div>


            <div class="student-card-actions">

                <button
                    type="button"
                    class="view-marks-button"
                    data-uid="${escapeHTML(student.uid)}"
                >

                    View / Edit Marks

                </button>


                <button
                    type="button"
                    class="delete-button"
                    data-uid="${escapeHTML(student.uid)}"
                >

                    Delete

                </button>

            </div>

        </div>

    `;

}


/* =====================================================
   OPEN MARKS MODAL
===================================================== */

async function openMarksModal(uid) {

    const student =
        allStudents.find(
            function(item) {

                return item.uid === uid;

            }
        );


    if (!student) {

        alert(
            "Student information not found."
        );

        return;

    }


    selectedStudent =
        student;


    const modal =
        document.getElementById(
            "marksModal"
        );


    const nameElement =
        document.getElementById(
            "modalStudentName"
        );


    const infoElement =
        document.getElementById(
            "modalStudentInfo"
        );


    const container =
        document.getElementById(
            "studentMarksContainer"
        );


    const message =
        document.getElementById(
            "marksSaveMessage"
        );


    nameElement.textContent =
        student.studentName ||
        "Student Marks";


    infoElement.textContent =
        `${student.studentId || "-"} • ${student.email || "-"}`;


    message.textContent =
        "";


    message.className =
        "modal-message";


    container.innerHTML = `

        <div class="loading-card">

            <div class="loading-spinner"></div>

            <p>
                Loading marks...
            </p>

        </div>

    `;


    modal.classList.add(
        "show"
    );


    /*
        GET MARKS FOR THIS STUDENT
    */

    const studentMarks =
        allMarks.filter(
            function(mark) {

                return (
                    String(mark.studentId)
                    .toUpperCase()
                    ===
                    String(student.studentId)
                    .toUpperCase()
                );

            }
        );


    /*
        SORT MARKS
    */

    studentMarks.sort(
        function(a, b) {

            const semesterDifference =
                Number(a.semester || 0) -
                Number(b.semester || 0);


            if (
                semesterDifference !== 0
            ) {

                return semesterDifference;

            }


            const examDifference =
                getExamNumber(a.exam) -
                getExamNumber(b.exam);


            if (
                examDifference !== 0
            ) {

                return examDifference;

            }


            return String(
                a.subject || ""
            ).localeCompare(
                String(
                    b.subject || ""
                )
            );

        }
    );


    renderStudentMarks(
        studentMarks
    );

}


/* =====================================================
   RENDER STUDENT MARKS
===================================================== */

function renderStudentMarks(marks) {

    const container =
        document.getElementById(
            "studentMarksContainer"
        );


    if (!container) return;


    if (
        marks.length === 0
    ) {

        container.innerHTML = `

            <div class="no-marks">

                <div style="font-size:35px;margin-bottom:10px;">
                    📝
                </div>

                <p>
                    No marks have been uploaded for this student yet.
                </p>

            </div>

        `;

        return;

    }


    /*
        GROUP BY SEMESTER
    */

    const semesters = {};


    marks.forEach(
        function(mark) {

            const semester =
                String(
                    mark.semester || 0
                );


            if (
                !semesters[semester]
            ) {

                semesters[semester] = {};

            }


            const exam =
                mark.exam ||
                "Unknown Exam";


            if (
                !semesters[semester][exam]
            ) {

                semesters[semester][exam] = [];

            }


            semesters[semester][exam].push(
                mark
            );

        }
    );


    const semesterNumbers =
        Object.keys(semesters)
            .sort(
                function(a, b) {

                    return Number(a) -
                        Number(b);

                }
            );


    container.innerHTML =
        semesterNumbers
            .map(
                function(semester) {

                    const exams =
                        semesters[semester];


                    const examNames =
                        Object.keys(exams)
                            .sort(
                                function(a, b) {

                                    return (
                                        getExamNumber(a) -
                                        getExamNumber(b)
                                    );

                                }
                            );


                    return `

                        <div class="semester-block">

                            <div class="semester-title">

                                Semester
                                ${escapeHTML(semester)}

                            </div>


                            ${examNames
                                .map(
                                    function(exam) {

                                        return createExamBlock(
                                            exam,
                                            exams[exam]
                                        );

                                    }
                                )
                                .join("")}

                        </div>

                    `;

                }
            )
            .join("");

}


/* =====================================================
   CREATE EXAM BLOCK
===================================================== */

function createExamBlock(
    exam,
    marks
) {

    /*
        Sort subjects
    */

    marks.sort(
        function(a, b) {

            return String(
                a.subject || ""
            ).localeCompare(
                String(
                    b.subject || ""
                )
            );

        }
    );


    return `

        <div class="exam-block">

            <div class="exam-title">

                ${escapeHTML(exam)}

            </div>


            <div class="mark-edit-grid">

                ${marks
                    .map(
                        function(mark) {

                            return `

                                <div class="mark-edit-item">

                                    <label>

                                        ${escapeHTML(
                                            mark.subject ||
                                            "Subject"
                                        )}

                                    </label>


                                    <div class="mark-input-wrapper">

                                        <input
                                            type="number"
                                            class="mark-edit-input"
                                            data-mark-id="${escapeHTML(mark.id)}"
                                            data-max="${Number(mark.maxMarks || 50)}"
                                            value="${Number(mark.marks || 0)}"
                                            min="0"
                                            max="${Number(mark.maxMarks || 50)}"
                                        >


                                        <span class="mark-max">

                                            /
                                            ${Number(mark.maxMarks || 50)}

                                        </span>

                                    </div>


                                    <div
                                        class="mark-percentage"
                                        id="modal-percentage-${escapeHTML(mark.id)}"
                                    >

                                        ${Number(
                                            mark.percentage || 0
                                        ).toFixed(1)}%

                                    </div>

                                </div>

                            `;

                        }
                    )
                    .join("")}

            </div>

        </div>

    `;

}


/* =====================================================
   UPDATE PERCENTAGE WHILE TYPING
===================================================== */

document.addEventListener(
    "input",
    function(event) {

        if (
            !event.target.classList.contains(
                "mark-edit-input"
            )
        ) {

            return;

        }


        const input =
            event.target;


        const markId =
            input.dataset.markId;


        const max =
            Number(
                input.dataset.max || 50
            );


        let marks =
            Number(
                input.value
            );


        if (
            marks < 0
        ) {

            marks = 0;

            input.value = 0;

        }


        if (
            marks > max
        ) {

            marks = max;

            input.value = max;

        }


        const percentage =
            max > 0
                ? marks / max * 100
                : 0;


        const percentageElement =
            document.getElementById(
                `modal-percentage-${markId}`
            );


        if (percentageElement) {

            percentageElement.textContent =
                percentage.toFixed(1) + "%";

        }

    }
);


/* =====================================================
   SAVE ALL MARK CHANGES
===================================================== */

const saveAllMarksButton =
    document.getElementById(
        "saveAllMarksButton"
    );


if (saveAllMarksButton) {

    saveAllMarksButton.addEventListener(
        "click",
        async function() {

            if (!selectedStudent) {

                return;

            }


            const inputs =
                document.querySelectorAll(
                    ".mark-edit-input"
                );


            const message =
                document.getElementById(
                    "marksSaveMessage"
                );


            if (
                inputs.length === 0
            ) {

                showMessage(
                    message,
                    "There are no marks to update.",
                    "error"
                );

                return;

            }


            try {

                saveAllMarksButton.disabled =
                    true;


                saveAllMarksButton.textContent =
                    "Saving...";


                const updates = [];


                /*
                    PREPARE ALL UPDATES
                */

                inputs.forEach(
                    function(input) {

                        const markId =
                            input.dataset.markId;


                        const maxMarks =
                            Number(
                                input.dataset.max ||
                                50
                            );


                        const marks =
                            Number(
                                input.value
                            );


                        if (
                            marks < 0 ||
                            marks > maxMarks
                        ) {

                            throw new Error(
                                `Marks must be between 0 and ${maxMarks}.`
                            );

                        }


                        const percentage =
                            Number(
                                (
                                    marks /
                                    maxMarks *
                                    100
                                ).toFixed(2)
                            );


                        updates.push({

                            id:
                                markId,

                            marks:
                                marks,

                            maxMarks:
                                maxMarks,

                            percentage:
                                percentage

                        });

                    }
                );


                /*
                    UPDATE FIRESTORE
                */

                await Promise.all(
                    updates.map(
                        function(item) {

                            return updateDoc(
                                doc(
                                    db,
                                    "marks",
                                    item.id
                                ),
                                {

                                    marks:
                                        item.marks,

                                    maxMarks:
                                        item.maxMarks,

                                    percentage:
                                        item.percentage,

                                    updatedAt:
                                        serverTimestamp()

                                }
                            );

                        }
                    )
                );


                /*
                    UPDATE LOCAL DATA
                */

                updates.forEach(
                    function(update) {

                        const mark =
                            allMarks.find(
                                function(item) {

                                    return (
                                        item.id ===
                                        update.id
                                    );

                                }
                            );


                        if (mark) {

                            mark.marks =
                                update.marks;

                            mark.maxMarks =
                                update.maxMarks;

                            mark.percentage =
                                update.percentage;

                        }

                    }
                );


                showMessage(
                    message,
                    "All marks updated successfully!",
                    "success"
                );


                /*
                    REFRESH DASHBOARD STATS
                */

                updateDashboardStats();

                renderStudentCards();

                renderRecentMarks();


            } catch (error) {

                console.error(
                    "Update marks error:",
                    error
                );


                showMessage(
                    message,
                    error.message ||
                    "Failed to update marks.",
                    "error"
                );


            } finally {

                saveAllMarksButton.disabled =
                    false;


                saveAllMarksButton.textContent =
                    "Save All Changes";

            }

        }
    );

}


/* =====================================================
   DELETE MODAL
===================================================== */

function openDeleteModal(uid) {

    const student =
        allStudents.find(
            function(item) {

                return item.uid === uid;

            }
        );


    if (!student) {

        return;

    }


    studentToDelete =
        student;


    const message =
        document.getElementById(
            "deleteStudentMessage"
        );


    message.textContent =
        `You are about to delete ${student.studentName || "this student"} (${student.studentId || "-"}) and all their marks.`;


    document
        .getElementById(
            "deleteModal"
        )
        .classList.add(
            "show"
        );

}


/* =====================================================
   CANCEL DELETE
===================================================== */

const cancelDeleteButton =
    document.getElementById(
        "cancelDeleteButton"
    );


if (cancelDeleteButton) {

    cancelDeleteButton.addEventListener(
        "click",
        closeDeleteModal
    );

}


/* =====================================================
   CONFIRM DELETE
===================================================== */

const confirmDeleteButton =
    document.getElementById(
        "confirmDeleteButton"
    );


if (confirmDeleteButton) {

    confirmDeleteButton.addEventListener(
        "click",
        async function() {

            if (!studentToDelete) {

                return;

            }


            try {

                confirmDeleteButton.disabled =
                    true;


                confirmDeleteButton.textContent =
                    "Deleting...";


                const student =
                    studentToDelete;


                /*
                    FIND ALL MARKS
                    BELONGING TO STUDENT
                */

                const studentMarks =
                    allMarks.filter(
                        function(mark) {

                            return (
                                String(
                                    mark.studentId
                                ).toUpperCase()
                                ===
                                String(
                                    student.studentId
                                ).toUpperCase()
                            );

                        }
                    );


                /*
                    FIRESTORE BATCH DELETE

                    This deletes marks in batches
                    instead of making many separate
                    requests.
                */

                if (
                    studentMarks.length > 0
                ) {

                    const batch =
                        writeBatch(db);


                    studentMarks.forEach(
                        function(mark) {

                            batch.delete(
                                doc(
                                    db,
                                    "marks",
                                    mark.id
                                )
                            );

                        }
                    );


                    await batch.commit();

                }


                /*
                    DELETE STUDENT PROFILE
                */

                await deleteDoc(
                    doc(
                        db,
                        "students",
                        student.uid
                    )
                );


                /*
                    UPDATE LOCAL ARRAYS
                */

                allStudents =
                    allStudents.filter(
                        function(item) {

                            return (
                                item.uid !==
                                student.uid
                            );

                        }
                    );


                allMarks =
                    allMarks.filter(
                        function(mark) {

                            return !(
                                String(
                                    mark.studentId
                                ).toUpperCase()
                                ===
                                String(
                                    student.studentId
                                ).toUpperCase()
                            );

                        }
                    );


                /*
                    CLOSE MODAL
                */

                closeDeleteModal();


                /*
                    REFRESH PAGE
                */

                updateDashboardStats();

                renderStudentCards();

                renderRecentMarks();


                alert(
                    "Student and all their marks were deleted successfully."
                );


            } catch (error) {

                console.error(
                    "Delete student error:",
                    error
                );


                alert(
                    "Failed to delete student: " +
                    error.message
                );


            } finally {

                confirmDeleteButton.disabled =
                    false;


                confirmDeleteButton.textContent =
                    "Delete Student";

            }

        }
    );

}


/* =====================================================
   CLOSE DELETE MODAL
===================================================== */

function closeDeleteModal() {

    const modal =
        document.getElementById(
            "deleteModal"
        );


    if (modal) {

        modal.classList.remove(
            "show"
        );

    }


    studentToDelete =
        null;

}


/* =====================================================
   MARKS MODAL CLOSE
===================================================== */

const closeMarksModalButton =
    document.getElementById(
        "closeMarksModal"
    );


if (closeMarksModalButton) {

    closeMarksModalButton.addEventListener(
        "click",
        closeMarksModal
    );

}


const cancelMarksButton =
    document.getElementById(
        "cancelMarksButton"
    );


if (cancelMarksButton) {

    cancelMarksButton.addEventListener(
        "click",
        closeMarksModal
    );

}


function closeMarksModal() {

    const modal =
        document.getElementById(
            "marksModal"
        );


    if (modal) {

        modal.classList.remove(
            "show"
        );

    }


    selectedStudent =
        null;

}


/* =====================================================
   CLICK OUTSIDE MODAL
===================================================== */

const marksModal =
    document.getElementById(
        "marksModal"
    );


if (marksModal) {

    marksModal.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                marksModal
            ) {

                closeMarksModal();

            }

        }
    );

}


const deleteModal =
    document.getElementById(
        "deleteModal"
    );


if (deleteModal) {

    deleteModal.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                deleteModal
            ) {

                closeDeleteModal();

            }

        }
    );

}


/* =====================================================
   RENDER RECENT MARKS
===================================================== */

function renderRecentMarks() {

    const table =
        document.getElementById(
            "marksTableBody"
        );


    if (!table) return;


    if (
        allMarks.length === 0
    ) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="empty-row"
                >

                    No marks uploaded yet.

                </td>

            </tr>

        `;

        return;

    }


    /*
        SHOW LAST 20
    */

    const latest =
        allMarks
            .slice()
            .reverse()
            .slice(0, 20);


    table.innerHTML =
        latest
            .map(
                function(mark) {

                    return `

                        <tr>

                            <td>

                                ${escapeHTML(
                                    mark.studentId || "-"
                                )}

                            </td>


                            <td>

                                ${escapeHTML(
                                    mark.studentName || "-"
                                )}

                            </td>


                            <td>

                                Semester
                                ${escapeHTML(
                                    String(
                                        mark.semester || "-"
                                    )
                                )}

                            </td>


                            <td>

                                ${escapeHTML(
                                    mark.exam || "-"
                                )}

                            </td>


                            <td>

                                ${escapeHTML(
                                    mark.subject || "-"
                                )}

                            </td>


                            <td>

                                ${Number(
                                    mark.marks || 0
                                )}
                                /
                                ${Number(
                                    mark.maxMarks || 50
                                )}

                            </td>


                            <td>

                                ${Number(
                                    mark.percentage || 0
                                ).toFixed(1)}%

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");

}


/* =====================================================
   HELPER:
   EXAM NUMBER
===================================================== */

function getExamNumber(exam) {

    const text =
        String(
            exam || ""
        );


    const match =
        text.match(
            /(\d+)/
        );


    if (!match) {

        return 999;

    }


    return Number(
        match[1]
    );

}


/* =====================================================
   HELPER:
   INITIALS
===================================================== */

function getInitials(name) {

    const words =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (
        words.length === 0
    ) {

        return "S";

    }


    if (
        words.length === 1
    ) {

        return words[0]
            .substring(0, 2)
            .toUpperCase();

    }


    return (
        words[0][0] +
        words[words.length - 1][0]
    ).toUpperCase();

}


/* =====================================================
   HELPER:
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =====================================================
   HELPER:
   MESSAGE
===================================================== */

function showMessage(
    element,
    text,
    type
) {

    if (!element) return;


    element.textContent =
        text;


    element.className =
        type === "success"

            ? "message success"

            : "message error";

}


/* =====================================================
   INITIAL LOAD
===================================================== */

loadDashboard();