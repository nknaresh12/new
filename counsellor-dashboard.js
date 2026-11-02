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
    setDoc,
    updateDoc,
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
let attendanceRecords = [];


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

        await loadAttendance();
        setupAttendance();

        await loadRecentMarks();

        await loadLeaveRequests();


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


// ================= ATTENDANCE =================

async function loadAttendance() {
    try {
        attendanceRecords = [];
        const snapshot = await getDocs(collection(db, "attendance"));
        snapshot.forEach((docSnap) => {
            attendanceRecords.push({ id: docSnap.id, ...docSnap.data() });
        });
    } catch (error) {
        console.error("Error loading attendance:", error);
        attendanceRecords = [];
    }
}

function setupAttendance() {
    const dateInput = document.getElementById("attendanceDate");
    const semesterSelect = document.getElementById("attendanceSemester");

    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }

    dateInput?.addEventListener("change", renderAttendanceTable);
    semesterSelect?.addEventListener("change", renderAttendanceTable);

    document.getElementById("markAllPresentBtn")?.addEventListener("click", () => {
        document.querySelectorAll(".attendance-status-select").forEach((select) => {
            select.value = "present";
        });
    });

    document.getElementById("saveAttendanceBtn")?.addEventListener("click", saveAttendance);
    renderAttendanceTable();
}

function renderAttendanceTable() {
    const tbody = document.getElementById("attendanceTableBody");
    const date = document.getElementById("attendanceDate")?.value;
    const semester = document.getElementById("attendanceSemester")?.value || "1";

    if (!tbody) return;
    tbody.innerHTML = "";

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty">No students found.</td></tr>`;
        return;
    }

    students.forEach((student) => {
        const existing = attendanceRecords.find((record) =>
            record.studentUid === student.uid &&
            record.date === date &&
            String(record.semester) === String(semester)
        );

        const status = existing?.status || "present";
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(student.studentId || "-")}</td>
            <td><strong>${escapeHTML(student.studentName || student.name || "-")}</strong></td>
            <td>${escapeHTML(student.email || "-")}</td>
            <td>
                <select class="attendance-status-select" data-student-uid="${escapeHTML(student.uid)}">
                    <option value="present" ${status === "present" ? "selected" : ""}>Present</option>
                    <option value="absent" ${status === "absent" ? "selected" : ""}>Absent</option>
                    <option value="leave" ${status === "on-duty" ? "selected" : ""}>On-duty</option>
                </select>
            </td>`;

        tbody.appendChild(row);
    });
}

async function saveAttendance() {
    const date = document.getElementById("attendanceDate")?.value;
    const semester = document.getElementById("attendanceSemester")?.value || "1";
    const saveButton = document.getElementById("saveAttendanceBtn");

    if (!date) {
        showAttendanceMessage("Please select an attendance date.", "error");
        return;
    }

    const selects = Array.from(document.querySelectorAll(".attendance-status-select"));
    if (selects.length === 0) {
        showAttendanceMessage("No students are available.", "error");
        return;
    }

    // A student cannot exceed 4 leave days in the same semester.
    for (const select of selects) {
        if (select.value !== "leave") continue;

        const usedLeaves = attendanceRecords.filter((record) =>
            record.studentUid === select.dataset.studentUid &&
            String(record.semester) === String(semester) &&
            record.status === "leave" &&
            record.date !== date
        ).length;

        if (usedLeaves >= 4) {
            const student = students.find((item) => item.uid === select.dataset.studentUid);
            showAttendanceMessage(
                `${student?.studentName || "A student"} has already used all 4 leave days for this semester.`,
                "error"
            );
            return;
        }
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        for (const select of selects) {
            const student = students.find((item) => item.uid === select.dataset.studentUid);
            if (!student) continue;

            const attendanceId = `${student.uid}_${semester}_${date}`;

            await setDoc(doc(db, "attendance", attendanceId), {
                studentUid: student.uid,
                studentId: student.studentId || "",
                studentName: student.studentName || student.name || "",
                date,
                semester: Number(semester),
                status: select.value,
                uploadedBy: currentCounsellor?.uid || auth.currentUser?.uid || "",
                uploadedAt: serverTimestamp()
            }, { merge: true });
        }

        await loadAttendance();
        renderAttendanceTable();
        showAttendanceMessage("Attendance saved successfully.", "success");
    } catch (error) {
        console.error("Attendance save error:", error);
        showAttendanceMessage("Unable to save attendance. Check Firebase and Firestore rules.", "error");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Attendance";
    }
}

function showAttendanceMessage(text, type) {
    const message = document.getElementById("attendanceMessage");
    if (!message) return;
    message.textContent = text;
    message.className = `message ${type}`;
}


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
            "marks",
            "attendance",
            "leave"
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

        if (section === "attendance") {
            navButtons[3]?.classList.add("active");

            document.getElementById(
                "pageTitle"
            ).textContent =
                "Student Attendance";

            renderAttendanceTable();
        }

        if (section === "leave") {
            navButtons[4]?.classList.add("active");

            document.getElementById(
                "pageTitle"
            ).textContent =
                "Leave Requests";

            loadLeaveRequests();
        }

    };


// ================= LEAVE REQUESTS =================

let leaveRequests = [];

async function loadLeaveRequests() {

    const container = document.getElementById("leaveRequestsContainer");
    if (!container) return;

    container.innerHTML = `<div class="loading-card">Loading leave requests...</div>`;

    try {

        let snapshot;

        try {
            const leaveQuery = query(
                collection(db, "leaveRequests"),
                orderBy("submittedAt", "desc")
            );
            snapshot = await getDocs(leaveQuery);
        } catch (indexError) {
            snapshot = await getDocs(collection(db, "leaveRequests"));
        }

        leaveRequests = [];

        snapshot.forEach(docSnap => {
            leaveRequests.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        renderLeaveRequests();

    } catch (error) {
        console.error("Error loading leave requests:", error);
        container.innerHTML = `<div class="loading-card">Unable to load leave requests.</div>`;
    }
}

function renderLeaveRequests() {

    const container = document.getElementById("leaveRequestsContainer");
    const filterValue = document.getElementById("leaveStatusFilter")?.value || "pending";

    if (!container) return;

    const filtered = filterValue === "all"
        ? leaveRequests
        : leaveRequests.filter(r => r.status === filterValue);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="loading-card">No ${filterValue === "all" ? "" : filterValue} leave requests found.</div>`;
        return;
    }

    container.innerHTML = "";

    filtered.forEach(request => {

        const card = document.createElement("div");
        card.className = `leave-request-card leave-${request.status || "pending"}`;

        const submittedDate = formatLeaveDate(request.submittedAt);
        const reviewedDate = request.reviewedAt ? formatLeaveDate(request.reviewedAt) : null;

        card.innerHTML = `
            <div class="leave-card-header">
                <div class="leave-student-info">
                    <div class="leave-avatar">${escapeHTML((request.studentName || "S").charAt(0).toUpperCase())}</div>
                    <div>
                        <h3>${escapeHTML(request.studentName || "Unknown Student")}</h3>
                        <span class="leave-student-id">${escapeHTML(request.studentId || "No ID")} · ${escapeHTML(request.department || "--")}</span>
                    </div>
                </div>
                <span class="leave-status-badge ${request.status || "pending"}">${capitalize(request.status || "pending")}</span>
            </div>

            <div class="leave-card-details">
                <div class="leave-detail">
                    <span>Section</span>
                    <strong>${escapeHTML(request.section || "--")}</strong>
                </div>
                <div class="leave-detail">
                    <span>Semester</span>
                    <strong>${request.semester || "--"}</strong>
                </div>
                <div class="leave-detail">
                    <span>Days Requested</span>
                    <strong>${request.leaveDays || "--"}</strong>
                </div>
                <div class="leave-detail">
                    <span>Submitted</span>
                    <strong>${submittedDate}</strong>
                </div>
            </div>

            <div class="leave-reason">
                <span>Reason</span>
                <p>${escapeHTML(request.reason || "No reason provided")}</p>
            </div>

            ${request.status === "pending" ? `
                <div class="leave-actions" data-id="${request.id}">
                    <button class="leave-approve-btn" onclick="handleLeaveAction('${request.id}', 'approved')">Approve</button>
                    <button class="leave-reject-btn" onclick="handleLeaveAction('${request.id}', 'rejected')">Reject</button>
                </div>
            ` : `
                <div class="leave-reviewed-info">
                    ${reviewedDate ? `Reviewed on ${reviewedDate}` : ""}
                    ${request.reviewedBy ? ` by ${escapeHTML(request.reviewedBy)}` : ""}
                </div>
            `}
        `;

        container.appendChild(card);
    });
}

window.handleLeaveAction = async function(requestId, action) {

    const btn = document.querySelector(`.leave-actions[data-id="${requestId}"] .leave-${action === "approved" ? "approve" : "reject"}-btn`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = action === "approved" ? "Approving..." : "Rejecting...";
    }

    try {

        const requestRef = doc(db, "leaveRequests", requestId);

        await updateDoc(requestRef, {
            status: action,
            reviewedAt: serverTimestamp(),
            reviewedBy: currentCounsellor?.name || "Counsellor"
        });

        const index = leaveRequests.findIndex(r => r.id === requestId);
        if (index !== -1) {
            leaveRequests[index].status = action;
            leaveRequests[index].reviewedBy = currentCounsellor?.name || "Counsellor";
            leaveRequests[index].reviewedAt = new Date();
        }

        renderLeaveRequests();

    } catch (error) {
        console.error("Leave action error:", error);
        alert("Failed to update leave request. Please try again.");
        if (btn) {
            btn.disabled = false;
            btn.textContent = action === "approved" ? "Approve" : "Reject";
        }
    }
};

function formatLeaveDate(timestamp) {
    if (!timestamp) return "--";

    let date;
    if (typeof timestamp.toDate === "function") {
        date = timestamp.toDate();
    } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        return "--";
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Setup leave filter
document.getElementById("leaveStatusFilter")?.addEventListener("change", renderLeaveRequests);


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
