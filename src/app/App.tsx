import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AppProvider, useApp } from "./store";
import { useT } from "./useT";

import Landing from "./Landing";
import Login from "./Login";
import TeacherLayout from "./TeacherLayout";
import StudentLayout from "./StudentLayout";
import TeacherDashboard from "./TeacherDashboard";
import TeacherClasses from "./TeacherClasses";
import TeacherMaterials from "./TeacherMaterials";
import MaterialCreate from "./MaterialCreate";
import MaterialReview from "./MaterialReview";
import TeacherAnalytics from "./TeacherAnalytics";
import TeacherRewards from "./TeacherRewards";
import StudentProfile from "./StudentProfile";
import Settings from "./Settings";
import StudentDashboard from "./StudentDashboard";
import ReadingWorkspace from "./ReadingWorkspace";
import Quiz from "./Quiz";
import Results from "./Results";
import StudentRewards from "./StudentRewards";
import StudentPractice from "./StudentPractice";
import SchoolAdmin from "./SchoolAdmin";

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: "teacher" | "student" }) {
  const { user, authReady } = useApp();
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-9 h-9 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard"} replace />;
  }
  return <>{children}</>;
}

function NotFound() {
  const { user } = useApp();
  const { t } = useT();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-5">
      <div className="text-center max-w-sm">
        <div className="text-7xl font-bold text-primary/20 mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">{t("common.pageNotFound")}</h1>
        <p className="text-muted-foreground mb-6 text-sm">{t("common.pageMissing")}</p>
        <a
          href={user ? (user.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard") : "/"}
          className="bg-primary text-primary-foreground font-medium px-6 py-2.5 rounded-xl hover:bg-primary/90 transition-colors inline-block"
        >
          {t("common.backHome")}
        </a>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, authReady } = useApp();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-9 h-9 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={user.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard"} replace />
          ) : (
            <Login />
          )
        }
      />

      {/* Teacher routes */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute role="teacher">
            <TeacherLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/teacher/dashboard" replace />} />
        <Route path="dashboard" element={<TeacherDashboard />} />
        <Route path="classes" element={<TeacherClasses />} />
        <Route path="materials" element={<TeacherMaterials />} />
        <Route path="materials/new" element={<MaterialCreate />} />
        <Route path="materials/:id/review" element={<MaterialReview />} />
        <Route path="analytics" element={<TeacherAnalytics />} />
        <Route path="rewards" element={<TeacherRewards />} />
        <Route path="students/:id" element={<StudentProfile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<SchoolAdmin />} />
      </Route>

      {/* Student routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute role="student">
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/student/dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="read/:id" element={<ReadingWorkspace />} />
        <Route path="quiz/:id" element={<Quiz />} />
        <Route path="results/:id" element={<Results />} />
        <Route path="practice/:id" element={<StudentPractice />} />
        <Route path="rewards" element={<StudentRewards />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
