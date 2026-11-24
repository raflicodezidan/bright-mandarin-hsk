"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { generatePassword } from "@/lib/password";
import { createTeacherAction } from "@/app/admin/teachers/actions";

type Created = { username: string; password: string };

export function CreateTeacherDialog() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [fullName, setFullName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<Created | null>(null);
  const [copied, setCopied] = React.useState(false);

  function reset() {
    setFullName("");
    setUsername("");
    setPassword("");
    setError(null);
    setCreated(null);
    setCopied(false);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTeacherAction({ fullName, username, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreated(result.data);
      toast("Akun guru berhasil dibuat.");
      router.refresh();
    });
  }

  async function copyPassword() {
    if (!created) return;
    await navigator.clipboard.writeText(created.password);
    setCopied(true);
  }

  return (
    <>
      <Button
        icon={<Plus size={16} strokeWidth={1.5} aria-hidden="true" />}
        onClick={() => setOpen(true)}
      >
        Tambah guru
      </Button>
      <Dialog
        open={open}
        onClose={close}
        presentation="drawer"
        title={created ? "Guru berhasil dibuat" : "Tambah guru"}
        description={
          created
            ? "Salin password sekarang. Password tidak ditampilkan lagi."
            : "Akun guru langsung aktif dan dapat mengelola murid serta tesnya."
        }
        footer={
          created ? (
            <Button onClick={close}>Selesai</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={close} disabled={pending}>
                Batal
              </Button>
              <Button type="submit" form="create-teacher-form" loading={pending}>
                Simpan
              </Button>
            </>
          )
        }
      >
        {created ? (
          <div className="flex flex-col gap-4">
            <Alert tone="warning">
              Password hanya ditampilkan sekali. Berikan kepada guru sekarang.
            </Alert>
            <dl className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-text-muted">Username</dt>
                <dd className="font-mono text-sm">{created.username}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-text-muted">Password</dt>
                <dd className="flex items-center gap-2">
                  <span className="rounded-sm border border-border bg-surface-muted px-3 py-2 font-mono text-sm">
                    {created.password}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={
                      copied ? (
                        <Check size={14} strokeWidth={1.5} aria-hidden="true" />
                      ) : (
                        <Copy size={14} strokeWidth={1.5} aria-hidden="true" />
                      )
                    }
                    onClick={copyPassword}
                  >
                    {copied ? "Tersalin" : "Salin"}
                  </Button>
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <form
            id="create-teacher-form"
            onSubmit={submit}
            className="flex flex-col gap-4"
          >
            {error ? <Alert tone="error">{error}</Alert> : null}
            <Field label="Nama lengkap" htmlFor="teacher-name" required>
              <Input
                id="teacher-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={120}
                required
                disabled={pending}
              />
            </Field>
            <Field
              label="Username"
              htmlFor="teacher-username"
              hint="Huruf kecil, angka, titik, atau garis bawah. 3-30 karakter."
              required
            >
              <Input
                id="teacher-username"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value.toLowerCase())
                }
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={pending}
              />
            </Field>
            <Field label="Password awal" htmlFor="teacher-password" required>
              <div className="flex gap-2">
                <Input
                  id="teacher-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                  disabled={pending}
                />
                <Button
                  variant="secondary"
                  onClick={() => setPassword(generatePassword(10))}
                  disabled={pending}
                  className="shrink-0"
                >
                  Buat otomatis
                </Button>
              </div>
            </Field>
          </form>
        )}
      </Dialog>
    </>
  );
}
