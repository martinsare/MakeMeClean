import { Route, Switch, useLocation } from "wouter";
import { Suspense, lazy, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ConsentBanner from "@/components/ConsentBanner";
import AIChatWidget from "@/components/AIChatWidget";
import { updatePageMeta, seoDefaults, setNoIndex } from "@/lib/seo";
import { initializeAnalytics, trackPageView } from "@/lib/analytics";
import { startPaymentConfirmationRetries } from "@/lib/paymentConfirmations";
const Home = lazy(() => import("@/pages/Home"));
const Services = lazy(() => import("@/pages/Services"));
const ServiceDetail = lazy(() => import("@/pages/ServiceDetail"));
const BookingPage = lazy(() => import("@/pages/BookingPage"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Profile = lazy(() => import("@/pages/Profile"));
const Bookings = lazy(() => import("@/pages/Bookings"));
const BookingDetail = lazy(() => import("@/pages/BookingDetail"));
const PaymentPage = lazy(() => import("@/pages/PaymentPage"));
const InvoicePage = lazy(() => import("@/pages/InvoicePage"));
const AdminPanel = lazy(() => import("@/pages/AdminPanel"));
const AdminServices = lazy(() => import("@/pages/AdminServices"));
const AdminApplicants = lazy(() => import("@/pages/AdminApplicants"));
const AdminApplicantDetail = lazy(() => import("@/pages/AdminApplicantDetail"));
const AdminStaff = lazy(() => import("@/pages/AdminStaff"));
const AdminReschedules = lazy(() => import("@/pages/AdminReschedules"));
const AdminContactMessages = lazy(() => import("@/pages/AdminContactMessages"));
const AdminPlans = lazy(() => import("@/pages/AdminPlans"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const StaffDashboard = lazy(() => import("@/pages/StaffDashboard"));
const StaffAvailability = lazy(() => import("@/pages/StaffAvailability"));
const StaffPayslips = lazy(() => import("@/pages/StaffPayslips"));
const AdminPayroll = lazy(() => import("@/pages/AdminPayroll"));
const ChangePassword = lazy(() => import("@/pages/ChangePassword"));
const Careers = lazy(() => import("@/pages/Careers"));
const ReviewPage = lazy(() => import("@/pages/ReviewPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const MyPlans = lazy(() => import("@/pages/MyPlans"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const CancellationPolicy = lazy(() => import("@/pages/CancellationPolicy"));
const AccessibilityStatement = lazy(
  () => import("@/pages/AccessibilityStatement")
);
const ComplaintsProcedure = lazy(() => import("@/pages/ComplaintsProcedure"));
const ServiceTerms = lazy(() => import("@/pages/ServiceTerms"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogArticle = lazy(() => import("@/pages/BlogArticle"));
const UnsubscribePage = lazy(() => import("@/pages/UnsubscribePage"));
const BookingPhotos = lazy(() => import("@/pages/BookingPhotos"));
const BookingRefundRequest = lazy(() => import("@/pages/BookingRefundRequest"));
const AdminRefunds = lazy(() => import("@/pages/AdminRefunds"));
const AdminPhotos = lazy(() => import("@/pages/AdminPhotos"));
const Loyalty = lazy(() => import("@/pages/Loyalty"));
const AdminLoyalty = lazy(() => import("@/pages/AdminLoyalty"));

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    trackPageView(location, document.title);

    // Apply noindex dynamically to private/auth utility pages so search engines drop them
    const noIndexPrefixes = [
      "/forgot-password",
      "/reset-password",
      "/change-password",
      "/login",
      "/register",
      "/dashboard",
      "/profile",
      "/bookings",
      "/booking-detail",
      "/pay",
      "/payment",
      "/invoice",
      "/admin",
      "/staff",
    ];
    const shouldNoIndex = noIndexPrefixes.some((prefix) => location.startsWith(prefix));
    setNoIndex(shouldNoIndex);
  }, [location]);
  return null;
}

function App() {
  const { loading, user } = useAuth();
  const [location, setLocation] = useLocation();
  const isAdminRoute = location.startsWith("/admin");
  const isStaffRoute = location.startsWith("/staff");

  useEffect(() => {
    // Initialize Google Analytics on first load
    initializeAnalytics();
    // Update SEO meta tags based on current page
    updatePageMeta(seoDefaults.home);
    return startPaymentConfirmationRetries();
  }, []);

  useEffect(() => {
    if (
      !loading &&
      user?.user_metadata?.must_change_password &&
      location !== "/change-password"
    )
      setLocation("/change-password");
  }, [loading, user, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/logo.png"
            alt="MakeMeClean"
            className="w-12 h-12 rounded-2xl"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ScrollToTop />
      {!isAdminRoute && !isStaffRoute && <Navbar />}
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="min-h-[40vh] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/services" component={Services} />
            <Route path="/services/:id" component={ServiceDetail} />
            <Route path="/service/:id" component={ServiceDetail} />
            <Route path="/book/:serviceId?" component={BookingPage} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/profile" component={Profile} />
            <Route path="/bookings" component={Bookings} />
            <Route path="/bookings/:id" component={BookingDetail} />
            <Route path="/booking-detail/:id" component={BookingDetail} />
            <Route path="/pay/:bookingId" component={PaymentPage} />
            <Route path="/payment/:bookingId" component={PaymentPage} />
            <Route path="/invoice/:bookingId" component={InvoicePage} />
            <Route path="/contact" component={ContactPage} />
            <Route path="/plans" component={MyPlans} />
            <Route path="/my-plans" component={MyPlans} />
            <Route path="/admin" component={AdminPanel} />
            <Route path="/admin/services" component={AdminServices} />
            <Route
              path="/admin/applicants/:id"
              component={AdminApplicantDetail}
            />
            <Route path="/admin/applicants" component={AdminApplicants} />
            <Route path="/admin/staff" component={AdminStaff} />
            <Route path="/admin/reschedules" component={AdminReschedules} />
            <Route path="/admin/plans" component={AdminPlans} />
            <Route path="/admin/messages" component={AdminContactMessages} />
            <Route path="/admin/settings" component={AdminSettings} />
            <Route path="/staff" component={StaffDashboard} />
            <Route path="/staff/availability" component={StaffAvailability} />
            <Route path="/staff/payslips" component={StaffPayslips} />
            <Route path="/admin/payroll" component={AdminPayroll} />
            <Route path="/change-password" component={ChangePassword} />
            <Route path="/careers" component={Careers} />
            <Route path="/review/:bookingId" component={ReviewPage} />
            <Route path="/terms" component={TermsPage} />
            <Route path="/privacy" component={PrivacyPage} />
            <Route path="/cancellation" component={CancellationPolicy} />
            <Route path="/cancellation-policy" component={CancellationPolicy} />
            <Route path="/accessibility" component={AccessibilityStatement} />
            <Route path="/complaints" component={ComplaintsProcedure} />
            <Route path="/service-terms" component={ServiceTerms} />
            <Route path="/blog/:slug" component={BlogArticle} />
            <Route path="/blog" component={Blog} />
            <Route path="/unsubscribe" component={UnsubscribePage} />
            <Route
              path="/bookings/:bookingId/photos"
              component={BookingPhotos}
            />
            <Route
              path="/bookings/:bookingId/refund"
              component={BookingRefundRequest}
            />
            <Route path="/admin/refunds" component={AdminRefunds} />
            <Route path="/admin/photos" component={AdminPhotos} />
            <Route path="/loyalty" component={Loyalty} />
            <Route path="/admin/loyalty" component={AdminLoyalty} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
      {!isAdminRoute && !isStaffRoute && <Footer />}
      {!isAdminRoute && !isStaffRoute && <ConsentBanner />}
      {!isAdminRoute && !isStaffRoute && <AIChatWidget />}
    </div>
  );
}

export default App;
