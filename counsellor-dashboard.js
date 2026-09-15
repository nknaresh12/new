import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getFirestore,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    doc,
    getDoc,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ================= FIREBASE =================

const firebaseConfig = {
    apiKey: "AIzaSyByRLQj6i2c2GhM21-cmRkSISbIVbfyZQU",
    authDomain: "student-progress-tracker-33064.firebaseapp.com",
    projectId: "student-progress-tracker-33064",
    storageBucket: "student-progress-tracker-33064.firebasestorage.app",
    messagingSenderId: "549690484739",
    appId: "1:549690484739:web:903b227ae9d9a238ae8636",
    measurementId: "G-30WQXGEKT8"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


// ================= GLOBAL DATA =================

let currentCounsellor = null;

let students = [];


// ================= PAGE ELEMENTS =================

const counsellorName =
    document.getElementById("counsellorName");

const counsellorEmail =
    document.getElementById("counsellorEmail");

const welcomeName =
    document.getElementById("welcomeName");

const totalStudents =
    document.getElementById("totalStudents");

const totalMarks =
    document.getElementById("totalMarks");

const studentsContainer =
    document.getElementById("studentsContainer");

const studentSelect =
    document.getElementById("studentSelect");

const marksForm =
    document.getElementById("marksForm");

const uploadButton =
    document.getElementById("uploadButton");

const marksMessage =
    document.getElementById("marksMessage");

const recentMarksTable =
    document.getElementById("recentMarksTable");

const logoutButton =
    document.getElementById("logoutButton");


// ================= AUTH CHECK =================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "./counsellor.html";

        return;
    }


    try {

        const counsellorRef =
            doc(db, "counsellors", user.uid);

        const counsellorSnap =
            await getDoc(counsellorRef);


        if (!counsellorSnap.exists()) {

            alert(
                "Your counsellor account is not registered."
            );

            await signOut(auth);

            window.location.href =
                "./counsellor.html";

            return;
        }


        const data =
            counsellorSnap.data();


        if (data.active !== true) {

            alert(
                "Your counsellor access has been disabled."
            );

            await signOut(auth);

            window.location.href =
                "./counsellor.html";

            return;
        }


        currentCounsellor = data;


        const name =
            data.name || "Counsellor";

        counsellorName.textContent = name;

        welcomeName.textContent = name;

        counsellorEmail.textContent =
            data.email || user.email;


        await loadStudents();

        await loadRecentMarks();


    } catch (error) {

        console.error(
            "Dashboard authentication error:",
            error
        );

        alert(
            "Unable to load counsellor dashboard."
        );
    }

});


// ================= LOAD STUDENTS =================

async function loadStudents() {

    try {

        const snapshot =
            await getDocs(
                collection(db, "students")
            );


        students = [];


        snapshot.forEach((docSnap) => {

            students.push({
                id: docSnap.id,
                ...docSnap.data()
            });

        });


        totalStudents.textContent =
            students.length;


        displayStudents();

        populateStudentSelect();


        await countMarks();


    } catch (error) {

        console.error(
            "Error loading students:",
            error
        );

        studentsContainer.innerHTML = `
            <div class="loading-card">
                Unable to load students.
            </div>
        `;
    }
}


// ================= DISPLAY STUDENTS =================

function displayStudents() {

    if (students.length === 0) {

        studentsContainer.innerHTML = `
            <div class="loading-card">
                No students have been created yet.
            </div>
        `;

        return;
    }


    studentsContainer.innerHTML = "";


    students.forEach((student) => {

        const card =
            document.createElement("div");

        card.className = "student-card";


        const name =
            student.studentName ||
            student.name ||
            "Unnamed Student";

        const email =
            student.email ||
            "No email";

        const studentId =
            student.studentId ||
            "No ID";


        card.innerHTML = `

            <div class="student-top">

                <div class="student-avatar">
                    👨‍🎓
                </div>

                <div>

                    <h3>
                        ${escapeHTML(name)}
                    </h3>

                    <p class="email">
                        ${escapeHTML(email)}
                    </p>

                </div>

            </div>


            <div class="student-id">
                ID: ${escapeHTML(studentId)}
            </div>


            <button
                class="view-button"
                onclick="viewStudent('${student.id}')"
            >
                View Marks
            </button>

        `;


        studentsContainer.appendChild(card);

    });

}


// ================= STUDENT SELECT =================

function populateStudentSelect() {

    studentSelect.innerHTML =
        `<option value="">Select Student</option>`;


    students.forEach((student) => {

        const option =
            document.createElement("option");


        option.value =
            student.id;


        option.textContent =
            `${student.studentName || student.name || "Student"} - ${student.studentId || "No ID"}`;


        studentSelect.appendChild(option);

    });

}


// ================= COUNT MARKS =================

async function countMarks() {

    try {

        const snapshot =
            await getDocs(
                collection(db, "marks")
            );


        totalMarks.textContent =
            snapshot.size;


    } catch (error) {

        console.error(
            "Error counting marks:",
            error
        );

        totalMarks.textContent = "0";
    }
}


// ================= UPLOAD MARKS =================

marksForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const studentDocId =
            studentSelect.value;

        const semester =
            document.getElementById(
                "semesterSelect"
            ).value;

        const exam =
            document.getElementById(
                "examSelect"
            ).value;

        const subject =
            document.getElementById(
                "subjectSelect"
            ).value;

        const marks =
            Number(
                document.getElementById(
                    "marksInput"
                ).value
            );

        const maxMarks =
            Number(
                document.getElementById(
                    "maxMarksInput"
                ).value
            );


        if (!studentDocId ||
            !semester ||
            !exam ||
            !subject) {

            showMarksMessage(
                "Please fill all fields.",
                "error"
            );

            return;
        }


        if (marks < 0 ||
            marks > maxMarks) {

            showMarksMessage(
                "Marks must be between 0 and maximum marks.",
                "error"
            );

            return;
        }


        const student =
            students.find(
                s => s.id === studentDocId
            );


        if (!student) {

            showMarksMessage(
                "Student not found.",
                "error"
            );

            return;
        }


        uploadButton.disabled = true;

        uploadButton.textContent =
            "Uploading...";


        try {

            const percentage =
                Number(
                    ((marks / maxMarks) * 100)
                    .toFixed(2)
                );


            const examId =
                `sem${semester}_model${exam.replace(/\D/g, "")}`;


            await addDoc(
                collection(db, "marks"),
                {

                    studentId:
                        student.studentId,

                    studentName:
                        student.studentName ||
                        student.name,

                    studentUid:
                        student.uid,

                    semester:
                        Number(semester),

                    exam:
                        exam,

                    examId:
                        examId,

                    subject:
                        subject,

                    marks:
                        marks,

                    maxMarks:
                        maxMarks,

                    percentage:
                        percentage,

                    uploadedAt:
                        serverTimestamp()

                }
            );


            showMarksMessage(
                "Marks uploaded successfully!",
                "success"
            );


            marksForm.reset();


            document.getElementById(
                "maxMarksInput"
            ).value = "100";


            await countMarks();

            await loadRecentMarks();


        } catch (error) {

            console.error(
                "MARK UPLOAD ERROR:",
                error
            );


            showMarksMessage(
                "Failed to upload marks. Check Firebase and Firestore rules.",
                "error"
            );

        } finally {

            uploadButton.disabled = false;

            uploadButton.textContent =
                "Upload Marks";

        }

    }
);


// ================= MESSAGE =================

function showMarksMessage(
    text,
    type
) {

    marksMessage.textContent =
        text;


    marksMessage.style.color =
        type === "success"
            ? "#16a34a"
            : "#dc2626";
}


// ================= RECENT MARKS =================

async function loadRecentMarks() {

    try {

        let snapshot;


        try {

            const marksQuery =
                query(
                    collection(db, "marks"),
                    orderBy(
                        "uploadedAt",
                        "desc"
                    ),
                    limit(10)
                );


            snapshot =
                await getDocs(marksQuery);


        } catch (indexError) {

            console.warn(
                "Could not order marks. Loading normally."
            );


            snapshot =
                await getDocs(
                    collection(db, "marks")
                );

        }


        recentMarksTable.innerHTML = "";


        if (snapshot.empty) {

            recentMarksTable.innerHTML = `
                <tr>
                    <td colspan="5" class="empty">
                        No marks uploaded yet.
                    </td>
                </tr>
            `;

            return;
        }


        let count = 0;


        snapshot.forEach((docSnap) => {

            if (count >= 10) return;

            const mark =
                docSnap.data();


            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    ${escapeHTML(
                        mark.studentName || "Student"
                    )}
                </td>

                <td>
                    Semester ${mark.semester || "-"}
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
                    <strong>
                        ${mark.marks ?? "-"}
                        /
                        ${mark.maxMarks ?? 100}
                    </strong>
                </td>

            `;


            recentMarksTable.appendChild(row);

            count++;

        });


    } catch (error) {

        console.error(
            "Error loading recent marks:",
            error
        );


        recentMarksTable.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Unable to load marks.
                </td>
            </tr>
        `;
    }

}


// ================= VIEW STUDENT =================

window.viewStudent =
    async function(studentDocId) {

        const student =
            students.find(
                s => s.id === studentDocId
            );


        if (!student) return;


        document.getElementById(
            "modalStudentName"
        ).textContent =
            student.studentName ||
            student.name ||
            "Student";


        document.getElementById(
            "modalStudentEmail"
        ).textContent =
            student.email ||
            "No email";


        document.getElementById(
            "modalStudentId"
        ).textContent =
            student.studentId ||
            "No ID";


        const modal =
            document.getElementById(
                "studentModal"
            );


        modal.classList.add("show");


        const marksTable =
            document.getElementById(
                "studentMarksTable"
            );


        marksTable.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Loading marks...
                </td>
            </tr>
        `;


        try {

            const marksQuery =
                query(
                    collection(db, "marks"),
                    where(
                        "studentId",
                        "==",
                        student.studentId
                    )
                );


            const snapshot =
                await getDocs(marksQuery);


            document.getElementById(
                "modalTotalMarks"
            ).textContent =
                snapshot.size;


            marksTable.innerHTML = "";


            if (snapshot.empty) {

                marksTable.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty">
                            No marks available for this student.
                        </td>
                    </tr>
                `;

                return;
            }


            snapshot.forEach((docSnap) => {

                const mark =
                    docSnap.data();


                const row =
                    document.createElement("tr");


                row.innerHTML = `

                    <td>
                        ${mark.semester || "-"}
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
                        <strong>
                            ${mark.marks ?? "-"}
                            /
                            ${mark.maxMarks ?? 100}
                        </strong>
                    </td>

                    <td>
                        ${mark.percentage ?? "-"}%
                    </td>

                `;


                marksTable.appendChild(row);

            });


        } catch (error) {

            console.error(
                "Error loading student marks:",
                error
            );


            marksTable.innerHTML = `
                <tr>
                    <td colspan="5" class="empty">
                        Unable to load marks.
                    </td>
                </tr>
            `;
        }

    };


// ================= CLOSE MODAL =================

window.closeStudentModal =
    function() {

        document.getElementById(
            "studentModal"
        ).classList.remove("show");

    };


// ================= SECTION NAVIGATION =================

window.showSection =
    function(section) {

        const sections = [
            "dashboard",
            "students",
            "marks"
        ];


        sections.forEach((name) => {

            const element =
                document.getElementById(
                    `${name}Section`
                );


            if (element) {

                element.classList.remove(
                    "active-section"
                );

            }

        });


        const selected =
            document.getElementById(
                `${section}Section`
            );


        if (selected) {

            selected.classList.add(
                "active-section"
            );

        }


        document
            .querySelectorAll(".nav-item")
            .forEach((button) => {

                button.classList.remove(
                    "active"
                );

            });


        const navButtons =
            document.querySelectorAll(
                ".nav-item"
            );


        if (section === "dashboard") {
            navButtons[0]?.classList.add("active");

            document.getElementById(
                "pageTitle"
            ).textContent =
                "Counsellor Dashboard";
        }


        if (section === "students") {
            navButtons[1]?.classList.add("active");

            document.getElementById(
                "pageTitle"
            ).textContent =
                "Students";
        }


        if (section === "marks") {
            navButtons[2]?.classList.add("active");

            document.getElementById(
                "pageTitle"
            ).textContent =
                "Upload Marks";
        }

    };


// ================= LOGOUT =================

logoutButton.addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);

            window.location.href =
                "./counsellor.html";

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

        }

    }
);


// ================= HTML SAFETY =================

function escapeHTML(value) {

    if (value === null ||
        value === undefined) {

        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
