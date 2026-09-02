import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import ChatbotWidget from './components/ChatbotWidget';
import { appBasename } from './lib/base';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Checkout from './pages/Checkout';
import Learn from './pages/Learn';
import QuizPage from './pages/QuizPage';
import Notifications from './pages/Notifications';
import InstructorProfile, { InstructorsList } from './pages/InstructorProfile';
import StudentDashboard from './pages/student/StudentDashboard';
import {
  StudentCourses,
  StudentWishlist,
  StudentPurchases,
  StudentQuizzes,
  ProfilePage,
} from './pages/student/StudentPages';
import InstructorDashboard, {
  InstructorCourses,
  CreateCourse,
  InstructorEarnings,
  InstructorAnalytics,
  InstructorMessages,
} from './pages/instructor/InstructorPages';
import AdminDashboard, {
  AdminCourses,
  AdminUsers,
  AdminPayments,
  AdminCategories,
  AdminAnnouncements,
  AdminReports,
  AdminSettings,
} from './pages/admin/AdminPages';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter basename={appBasename || undefined}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:slug" element={<CourseDetail />} />
          <Route path="/instructors" element={<InstructorsList />} />
          <Route path="/instructors/:id" element={<InstructorProfile />} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/checkout/:courseId" element={<ProtectedRoute roles={['student']}><Checkout /></ProtectedRoute>} />
          <Route path="/learn/:slug" element={<ProtectedRoute roles={['student', 'instructor', 'admin']}><Learn /></ProtectedRoute>} />
          <Route path="/learn/:slug/quiz/:quizId" element={<ProtectedRoute roles={['student']}><QuizPage /></ProtectedRoute>} />

          <Route path="/student" element={<ProtectedRoute roles={['student']}><DashboardLayout role="student" /></ProtectedRoute>}>
            <Route index element={<StudentDashboard />} />
            <Route path="courses" element={<StudentCourses />} />
            <Route path="wishlist" element={<StudentWishlist />} />
            <Route path="purchases" element={<StudentPurchases />} />
            <Route path="quizzes" element={<StudentQuizzes />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="/instructor" element={<ProtectedRoute roles={['instructor', 'admin']}><DashboardLayout role="instructor" /></ProtectedRoute>}>
            <Route index element={<InstructorDashboard />} />
            <Route path="courses" element={<InstructorCourses />} />
            <Route path="create" element={<CreateCourse />} />
            <Route path="earnings" element={<InstructorEarnings />} />
            <Route path="analytics" element={<InstructorAnalytics />} />
            <Route path="messages" element={<InstructorMessages />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><DashboardLayout role="admin" /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="courses" element={<AdminCourses />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ChatbotWidget />
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
