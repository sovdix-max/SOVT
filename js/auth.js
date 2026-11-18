
/*
 * SOVDIX AUTH SYSTEM
 * Firebase Authentication
 * Email + Google + GitHub
 * Email Verification
 * Version 2.0.0
 */

(function () {

    "use strict";

    /* ================================
       FIREBASE CONFIG
    ================================= */

    const firebaseConfig = {

        apiKey: "YOUR_NEW_FIREBASE_API_KEY",

        authDomain: "sovdix-48ea4.firebaseapp.com",

        projectId: "sovdix-48ea4",

        storageBucket: "YOUR_NEW_STORAGE_BUCKET",

        messagingSenderId: "YOUR_NEW_MESSAGING_SENDER_ID",

        appId: "YOUR_NEW_FIREBASE_APP_ID"

    };


    /* ================================
       STATE
    ================================= */

    let firebaseApp = null;
    let firebaseAuth = null;

    let firebaseReady = false;
    let firebasePromise = null;


    /* ================================
       LOAD SCRIPT
    ================================= */

    function loadScript(src) {

        return new Promise(function (resolve, reject) {

            const existing = document.querySelector(
                'script[src="' + src + '"]'
            );

            if (existing) {

                if (existing.dataset.loaded === "true") {
                    resolve();
                    return;
                }

                existing.addEventListener("load", resolve, {
                    once: true
                });

                existing.addEventListener("error", reject, {
                    once: true
                });

                return;
            }

            const script = document.createElement("script");

            script.src = src;
            script.async = true;

            script.onload = function () {
                script.dataset.loaded = "true";
                resolve();
            };

            script.onerror = function () {
                reject(new Error("تعذر تحميل Firebase SDK"));
            };

            document.head.appendChild(script);

        });

    }


    /* ================================
       INITIALIZE FIREBASE
    ================================= */

    async function initializeFirebase() {

        if (firebaseReady) {
            return {
                app: firebaseApp,
                auth: firebaseAuth
            };
        }

        if (firebasePromise) {
            return firebasePromise;
        }

        firebasePromise = (async function () {

            try {

                if (
                    firebaseConfig.apiKey === "YOUR_NEW_FIREBASE_API_KEY" ||
                    firebaseConfig.appId === "YOUR_NEW_FIREBASE_APP_ID" ||
                    firebaseConfig.storageBucket === "YOUR_NEW_STORAGE_BUCKET" ||
                    firebaseConfig.messagingSenderId === "YOUR_NEW_MESSAGING_SENDER_ID"
                ) {
                    throw new Error(
                        "يجب وضع إعدادات Firebase الحقيقية أولاً."
                    );
                }

                await loadScript(
                    "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"
                );

                await loadScript(
                    "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"
                );

                if (!window.firebase) {
                    throw new Error("Firebase SDK غير متاح.");
                }

                const existingApp = window.firebase.apps.find(
                    app => app.name === "[DEFAULT]"
                );

                firebaseApp = existingApp ||
                    window.firebase.initializeApp(firebaseConfig);

                firebaseAuth = firebaseApp.auth();

                await firebaseAuth.setPersistence(
                    window.firebase.auth.Auth.Persistence.LOCAL
                );

                window.SOVTGoogleProvider =
                    new window.firebase.auth.GoogleAuthProvider();

                window.SOVTGoogleProvider.setCustomParameters({
                    prompt: "select_account"
                });

                window.SOVTGitHubProvider =
                    new window.firebase.auth.GithubAuthProvider();

                window.SOVTGitHubProvider.addScope("user:email");

                window.firebaseApp = firebaseApp;
                window.firebaseAuth = firebaseAuth;

                firebaseReady = true;

                console.log("SOVDIX AUTH: READY");

                return {
                    app: firebaseApp,
                    auth: firebaseAuth
                };

            } catch (error) {

                firebasePromise = null;
                firebaseReady = false;

                console.error("FIREBASE ERROR:", error);

                throw error;

            }

        })();

        return firebasePromise;

    }


    /* ================================
       READY
    ================================= */

    async function ready() {
        return await initializeFirebase();
    }


    /* ================================
       EMAIL VERIFICATION CHECK
    ================================= */

    function isEmailVerified(user) {

        if (!user) {
            return false;
        }

        const isPasswordAccount =
            user.providerData.some(function (provider) {
                return provider.providerId === "password";
            });

        // Google and GitHub accounts use their provider
        // authentication status instead of Firebase email verification.
        if (!isPasswordAccount) {
            return true;
        }

        return user.emailVerified === true;

    }


    /* ================================
       ACCESS CHECK
    ================================= */

    function canAccess(user) {

        if (!user) {
            return false;
        }

        return isEmailVerified(user);

    }


    /* ================================
       SEND VERIFICATION EMAIL
    ================================= */

    async function sendVerificationEmail(user) {

        await initializeFirebase();

        user = user || firebaseAuth.currentUser;

        if (!user) {
            throw new Error("يجب تسجيل الدخول أولاً.");
        }

        if (user.emailVerified) {
            return {
                success: true,
                alreadyVerified: true
            };
        }

        await user.sendEmailVerification();

        return {
            success: true,
            message: "تم إرسال رسالة التحقق بنجاح."
        };

    }


    /* ================================
       RESEND VERIFICATION EMAIL
    ================================= */

    async function resendVerificationEmail() {

        await initializeFirebase();

        const user = firebaseAuth.currentUser;

        if (!user) {
            throw new Error("لا يوجد مستخدم مسجل الدخول.");
        }

        await user.reload();

        if (user.emailVerified) {
            return {
                success: true,
                alreadyVerified: true
            };
        }

        await user.sendEmailVerification();

        return {
            success: true,
            message: "تمت إعادة إرسال رسالة التحقق."
        };

    }


    /* ================================
       REFRESH USER
    ================================= */

    async function refreshUser() {

        await initializeFirebase();

        const user = firebaseAuth.currentUser;

        if (!user) {
            return null;
        }

        await user.reload();

        return firebaseAuth.currentUser;

    }


    /* ================================
       CHECK VERIFICATION
    ================================= */

    async function checkEmailVerification() {

        const user = await refreshUser();

        if (!user) {
            return false;
        }

        return isEmailVerified(user);

    }


    /* ================================
       CURRENT USER
    ================================= */

    async function getCurrentUser() {

        await initializeFirebase();

        return new Promise(function (resolve) {

            let unsubscribe = function () {};

            unsubscribe = firebaseAuth.onAuthStateChanged(
                function (user) {

                    unsubscribe();

                    resolve(user || null);

                }
            );

        });

    }


    /* ================================
       EMAIL REGISTER
    ================================= */

    async function registerWithEmail(
        email,
        password,
        username
    ) {

        await initializeFirebase();

        const result =
            await firebaseAuth.createUserWithEmailAndPassword(
                email.trim(),
                password
            );

        const user = result.user;

        if (user && username) {

            await user.updateProfile({
                displayName: username.trim()
            });

        }

        // Send verification automatically.
        await sendVerificationEmail(user);

        return user;

    }


    /* ================================
       EMAIL LOGIN
    ================================= */

    async function loginWithEmail(
        email,
        password
    ) {

        await initializeFirebase();

        const result =
            await firebaseAuth.signInWithEmailAndPassword(
                email.trim(),
                password
            );

        const user = result.user;

        await user.reload();

        // User remains signed in so they can open
        // the verification page and resend the email.
        return firebaseAuth.currentUser;

    }


    /* ================================
       GOOGLE LOGIN
    ================================= */

    async function googleLogin() {

        await initializeFirebase();

        const result =
            await firebaseAuth.signInWithPopup(
                window.SOVTGoogleProvider
            );

        return result.user;

    }


    /* ================================
       GITHUB LOGIN
    ================================= */

    async function githubLogin() {

        await initializeFirebase();

        const result =
            await firebaseAuth.signInWithPopup(
                window.SOVTGitHubProvider
            );

        return result.user;

    }


    /* ================================
       LOGOUT
    ================================= */

    async function logout() {

        await initializeFirebase();

        await firebaseAuth.signOut();

        localStorage.removeItem("itachi_logged_in");

    }


    /* ================================
       AUTH STATE
    ================================= */

    async function listenAuthState(callback) {

        await initializeFirebase();

        return firebaseAuth.onAuthStateChanged(
            function (user) {

                if (canAccess(user)) {

                    localStorage.setItem(
                        "itachi_logged_in",
                        "true"
                    );

                } else {

                    localStorage.removeItem(
                        "itachi_logged_in"
                    );

                }

                if (typeof callback === "function") {
                    callback(user);
                }

            }
        );

    }


    /* ================================
       ERROR MESSAGES
    ================================= */

    function getErrorMessage(error) {

        const messages = {

            "auth/email-already-in-use":
                "هذا البريد الإلكتروني مسجل مسبقاً.",

            "auth/invalid-email":
                "البريد الإلكتروني غير صحيح.",

            "auth/weak-password":
                "كلمة المرور ضعيفة.",

            "auth/user-not-found":
                "الحساب غير موجود.",

            "auth/wrong-password":
                "كلمة المرور غير صحيحة.",

            "auth/invalid-credential":
                "بيانات تسجيل الدخول غير صحيحة.",

            "auth/too-many-requests":
                "محاولات كثيرة. حاول لاحقاً.",

            "auth/popup-closed-by-user":
                "تم إغلاق نافذة تسجيل الدخول.",

            "auth/account-exists-with-different-credential":
                "هذا البريد مرتبط بطريقة تسجيل دخول أخرى.",

            "auth/network-request-failed":
                "تحقق من اتصال الإنترنت.",

            "auth/unauthorized-domain":
                "النطاق غير مصرح به في Firebase.",

            "auth/operation-not-allowed":
                "طريقة تسجيل الدخول غير مفعلة في Firebase."

        };

        return messages[error.code] ||
            error.message ||
            "حدث خطأ غير متوقع.";

    }


    /* ================================
       GLOBAL SOVDIX API
    ================================= */

    window.SOVTFirebase = {

        ready: ready,

        getCurrentUser: getCurrentUser,

        registerWithEmail: registerWithEmail,

        loginWithEmail: loginWithEmail,

        googleLogin: googleLogin,

        githubLogin: githubLogin,

        logout: logout,

        listenAuthState: listenAuthState,

        sendVerificationEmail: sendVerificationEmail,

        resendVerificationEmail: resendVerificationEmail,

        refreshUser: refreshUser,

        checkEmailVerification: checkEmailVerification,

        isEmailVerified: isEmailVerified,

        canAccess: canAccess,

        getErrorMessage: getErrorMessage

    };


    /* ================================
       START
    ================================= */

    initializeFirebase().catch(function (error) {

        console.error(
            "SOVDIX AUTH INITIALIZATION FAILED:",
            error
        );

    });

})();
