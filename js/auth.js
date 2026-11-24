
/*
 * SOVDIX AUTH SYSTEM
 * Firebase Authentication
 * Email + Google + GitHub
 * Email Verification
 * SOVT API Integration
 * Version 2.2.0
 */

(function () {
    "use strict";

    /* =================================
       FIREBASE CONFIGURATION
    ================================= */

    const firebaseConfig = {
        apiKey: "AIzaSyBvp1F7USxnwhbykdhJmcVdD8H2kap88Fk",
        authDomain: "sovdix-48ea4.firebaseapp.com",
        projectId: "sovdix-48ea4",
        storageBucket: "sovdix-48ea4.firebasestorage.app",
        messagingSenderId: "885539173175",
        appId: "1:885539173175:web:610015125a9407824160b2",
        measurementId: "G-5QB9PVM5HQ"
    };

    const FIREBASE_VERSION = "10.12.5";

    /* =================================
       INTERNAL STATE
    ================================= */

    let firebaseApp = null;
    let firebaseAuth = null;
    let firebaseReady = false;
    let firebasePromise = null;

    /* =================================
       FIREBASE SDK LOADER
    ================================= */

    function loadScript(src) {

        return new Promise(function (resolve, reject) {

            const existing = Array.from(document.scripts).find(
                script => script.src === src
            );

            if (existing) {

                if (existing.dataset.loaded === "true") {
                    resolve();
                    return;
                }

                existing.addEventListener("load", resolve, {
                    once: true
                });

                existing.addEventListener("error", function () {
                    reject(new Error("تعذر تحميل Firebase SDK."));
                }, {
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
                reject(new Error("تعذر تحميل Firebase SDK."));
            };

            document.head.appendChild(script);
        });
    }

    /* =================================
       INITIALIZE FIREBASE
    ================================= */

    async function initializeFirebase() {

        if (firebaseReady && firebaseAuth) {
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

                await loadScript(
                    "https://www.gstatic.com/firebasejs/" +
                    FIREBASE_VERSION +
                    "/firebase-app-compat.js"
                );

                await loadScript(
                    "https://www.gstatic.com/firebasejs/" +
                    FIREBASE_VERSION +
                    "/firebase-auth-compat.js"
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

                /* Google Provider */

                window.SOVTGoogleProvider =
                    new window.firebase.auth.GoogleAuthProvider();

                window.SOVTGoogleProvider.setCustomParameters({
                    prompt: "select_account"
                });

                /* GitHub Provider */

                window.SOVTGitHubProvider =
                    new window.firebase.auth.GithubAuthProvider();

                window.SOVTGitHubProvider.addScope("user:email");

                /* Public Firebase References */

                window.firebaseApp = firebaseApp;
                window.firebaseAuth = firebaseAuth;

                firebaseReady = true;

                console.log("SOVDIX AUTH V2.2.0: READY");

                return {
                    app: firebaseApp,
                    auth: firebaseAuth
                };

            } catch (error) {

                firebasePromise = null;
                firebaseReady = false;

                console.error(
                    "SOVDIX FIREBASE ERROR:",
                    error
                );

                throw error;
            }

        })();

        return firebasePromise;
    }

    /* =================================
       READY
    ================================= */

    async function ready() {
        return initializeFirebase();
    }

    /* =================================
       PROVIDER INFORMATION
    ================================= */

    function getProviderIds(user) {

        if (!user || !Array.isArray(user.providerData)) {
            return [];
        }

        return user.providerData
            .map(provider => provider.providerId)
            .filter(Boolean);
    }

    /* =================================
       EMAIL VERIFICATION
    ================================= */

    function isEmailVerified(user) {

        if (!user || !user.email) {
            return false;
        }

        const providers = getProviderIds(user);

        const supportedProviders = [
            "password",
            "google.com",
            "github.com"
        ];

        const hasSupportedProvider = providers.some(
            provider => supportedProviders.includes(provider)
        );

        return hasSupportedProvider &&
            user.emailVerified === true;
    }

    /* =================================
       ACCESS CONTROL
    ================================= */

    function canAccess(user) {
        return isEmailVerified(user);
    }

    /* =================================
       GET CURRENT USER
    ================================= */

    async function getCurrentUser() {

        await initializeFirebase();

        return new Promise(function (resolve) {

            let unsubscribe = null;

            unsubscribe = firebaseAuth.onAuthStateChanged(
                function (user) {

                    if (unsubscribe) {
                        unsubscribe();
                    }

                    resolve(user || null);
                },

                function () {
                    resolve(null);
                }
            );
        });
    }

    /* =================================
       GET FIREBASE ID TOKEN
    ================================= */

    async function getIdToken(forceRefresh = false) {

        await initializeFirebase();

        const user = firebaseAuth.currentUser;

        if (!user) {
            throw new Error("يجب تسجيل الدخول أولًا.");
        }

        if (!canAccess(user)) {
            throw new Error("يجب تأكيد البريد الإلكتروني أولًا.");
        }

        return user.getIdToken(Boolean(forceRefresh));
    }

    /* =================================
       SEND VERIFICATION EMAIL
    ================================= */

    async function sendVerificationEmail(user) {

        await initializeFirebase();

        user = user || firebaseAuth.currentUser;

        if (!user) {
            throw new Error("يجب تسجيل الدخول أولًا.");
        }

        await user.reload();

        user = firebaseAuth.currentUser;

        if (!user) {
            throw new Error("تعذر العثور على الحساب.");
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

    /* =================================
       RESEND VERIFICATION EMAIL
    ================================= */

    async function resendVerificationEmail() {

        await initializeFirebase();

        const user = firebaseAuth.currentUser;

        if (!user) {
            throw new Error("لا يوجد مستخدم مسجل الدخول.");
        }

        await user.reload();

        const currentUser = firebaseAuth.currentUser;

        if (!currentUser) {
            throw new Error("تعذر العثور على الحساب.");
        }

        if (currentUser.emailVerified) {
            return {
                success: true,
                alreadyVerified: true
            };
        }

        await currentUser.sendEmailVerification();

        return {
            success: true,
            message: "تمت إعادة إرسال رسالة التحقق."
        };
    }

    /* =================================
       REFRESH USER
    ================================= */

    async function refreshUser() {

        await initializeFirebase();

        const user = firebaseAuth.currentUser;

        if (!user) {
            return null;
        }

        await user.reload();

        const refreshedUser = firebaseAuth.currentUser;

        if (refreshedUser) {
            await refreshedUser.getIdToken(true);
        }

        return refreshedUser;
    }

    /* =================================
       CHECK EMAIL VERIFICATION
    ================================= */

    async function checkEmailVerification() {

        const user = await refreshUser();

        if (!user) {
            return false;
        }

        return isEmailVerified(user);
    }

    /* =================================
       EMAIL REGISTER
    ================================= */

    async function registerWithEmail(
        email,
        password,
        username
    ) {

        await initializeFirebase();

        const cleanEmail = String(email || "").trim();
        const cleanUsername = String(username || "").trim();

        if (!cleanEmail || !password) {
            throw new Error("أدخل البريد وكلمة المرور.");
        }

        const result =
            await firebaseAuth.createUserWithEmailAndPassword(
                cleanEmail,
                password
            );

        const user = result.user;

        if (user && cleanUsername) {

            await user.updateProfile({
                displayName: cleanUsername
            });

        }

        await sendVerificationEmail(user);

        return user;
    }

    /* =================================
       EMAIL LOGIN
    ================================= */

    async function loginWithEmail(email, password) {

        await initializeFirebase();

        const cleanEmail = String(email || "").trim();

        const result =
            await firebaseAuth.signInWithEmailAndPassword(
                cleanEmail,
                password
            );

        await result.user.reload();

        return firebaseAuth.currentUser;
    }

    /* =================================
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

    /* =================================
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

    /* =================================
       LOGOUT
    ================================= */

    async function logout() {

        await initializeFirebase();

        await firebaseAuth.signOut();

        return {
            success: true,
            message: "تم تسجيل الخروج بنجاح."
        };
    }

    /* =================================
       AUTH STATE LISTENER
    ================================= */

    async function listenAuthState(callback) {

        await initializeFirebase();

        return firebaseAuth.onAuthStateChanged(
            async function (user) {

                let current = user || null;

                if (current) {

                    try {

                        await current.reload();

                        current = firebaseAuth.currentUser || current;

                    } catch (error) {

                        console.error(
                            "SOVDIX USER REFRESH ERROR:",
                            error
                        );
                    }
                }

                if (typeof callback === "function") {

                    try {

                        await callback(current);

                    } catch (error) {

                        console.error(
                            "SOVDIX AUTH CALLBACK ERROR:",
                            error
                        );
                    }
                }
            },

            function (error) {

                console.error(
                    "SOVDIX AUTH STATE ERROR:",
                    error
                );

                if (typeof callback === "function") {
                    callback(null);
                }
            }
        );
    }

    /* =================================
       USER INFORMATION
    ================================= */

    function getUserInfo(user) {

        user = user || (
            firebaseAuth
                ? firebaseAuth.currentUser
                : null
        );

        if (!user) {
            return null;
        }

        return {
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName || null,
            photoURL: user.photoURL || null,
            emailVerified: user.emailVerified === true,
            providers: getProviderIds(user),
            canAccess: canAccess(user)
        };
    }

    /* =================================
       AUTH ERROR TRANSLATIONS
    ================================= */

    function getErrorMessage(error) {

        const messages = {

            "auth/email-already-in-use":
                "هذا البريد الإلكتروني مسجل مسبقًا.",

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
                "محاولات كثيرة. حاول لاحقًا.",

            "auth/popup-closed-by-user":
                "تم إغلاق نافذة تسجيل الدخول.",

            "auth/account-exists-with-different-credential":
                "هذا البريد مرتبط بطريقة تسجيل دخول أخرى.",

            "auth/network-request-failed":
                "تحقق من اتصال الإنترنت.",

            "auth/unauthorized-domain":
                "النطاق غير مصرح به في Firebase.",

            "auth/operation-not-allowed":
                "طريقة تسجيل الدخول غير مفعلة في Firebase.",

            "auth/invalid-api-key":
                "إعداد Firebase غير صحيح.",

            "auth/web-storage-unsupported":
                "المتصفح لا يدعم التخزين المطلوب.",

            "auth/popup-blocked":
                "المتصفح منع نافذة تسجيل الدخول.",

            "auth/cancelled-popup-request":
                "تم إلغاء عملية تسجيل الدخول.",

            "auth/user-disabled":
                "هذا الحساب معطّل.",

            "auth/requires-recent-login":
                "يجب تسجيل الدخول مجددًا لتنفيذ هذه العملية.",

            "auth/expired-action-code":
                "رابط التحقق منتهي الصلاحية.",

            "auth/invalid-action-code":
                "رابط التحقق غير صالح."

        };

        if (error && error.code && messages[error.code]) {
            return messages[error.code];
        }

        return error?.message || "حدث خطأ غير متوقع.";
    }

    /* =================================
       PUBLIC SOVDIX AUTH API
    ================================= */

    window.SOVTFirebase = {

        version: "2.2.0",

        ready: ready,

        getCurrentUser: getCurrentUser,

        getIdToken: getIdToken,

        getUserInfo: getUserInfo,

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

    /* =================================
       START AUTH SYSTEM
    ================================= */

    initializeFirebase().catch(function (error) {

        console.error(
            "SOVDIX AUTH INITIALIZATION FAILED:",
            error
        );

    });

})();
