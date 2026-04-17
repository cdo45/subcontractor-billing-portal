import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        flexDirection: "column",
        gap: 24
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.02em"
          }}
        >
          VANCE CORP
        </div>
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: 13,
            marginTop: 4
          }}
        >
          Subcontractor Billing Portal
        </div>
      </div>

      <SignIn
        path="/login"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/after-login"
        appearance={{
          elements: {
            card: "card",
            formButtonPrimary: "btn btn-primary",
            rootBox: { width: 380 }
          }
        }}
      />
    </main>
  );
}
