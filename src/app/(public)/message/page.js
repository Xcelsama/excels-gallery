import MessageForm from "@/components/MessageForm";

export const metadata = { title: "Message Excel" };

export default function MessagePage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16 sm:px-8">
      <h1 className="font-display text-3xl text-ink sm:text-4xl">
        Message Excel
      </h1>
      <p className="mt-3 text-ink-muted">
        Questions, feedback, or a project you&rsquo;d like edited? Send a
        note below.
      </p>
      <div className="mt-10">
        <MessageForm />
      </div>
    </main>
  );
}
