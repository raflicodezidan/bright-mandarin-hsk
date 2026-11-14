"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import {
  AttemptStatusBadge,
  Badge,
  TestStatusBadge,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToastProvider, useToast } from "@/components/ui/toast";

const STUDENTS = [
  { name: "Andi Wijaya", username: "andi.wijaya", status: "Aktif", created: "12 Nov 2026" },
  { name: "Siti Rahmawati", username: "siti_rahma", status: "Aktif", created: "10 Nov 2026" },
  { name: "Budi Santoso", username: "budi.s", status: "Nonaktif", created: "03 Nov 2026" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {description ? (
          <p className="text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Demos() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Styleguide"
        description="Halaman internal. Hanya aktif di mode development."
        actions={<Button variant="secondary">Aksi contoh</Button>}
      />

      <Section title="Tipografi" description="IBM Plex Sans, IBM Plex Mono, Noto Sans SC.">
        <div className="grid gap-6 rounded-md border border-border bg-surface p-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <p className="text-xl font-semibold">Judul halaman 24/32 · 600</p>
            <p className="text-lg font-semibold">Judul bagian 18/28 · 600</p>
            <p className="text-base font-semibold">Judul kartu 16/24 · 600</p>
            <p className="text-sm">Body admin 14/20 · 400. Teks contoh untuk memeriksa tinggi baris.</p>
            <p className="text-xs font-medium text-text-muted">
              Label, caption, header tabel 13/18 · 500
            </p>
            <p className="font-mono text-stat font-medium tabular">35:00</p>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-question" lang="zh-Hans">
              今天天气很好，我们去公园散步吧。
            </p>
            <p className="text-option" lang="zh-Hans">
              A. 好的，我很喜欢公园。
            </p>
            <p className="font-cjk text-sm" lang="zh-Hans">
              汉字测试：听力、阅读、考试、学生、老师。
            </p>
          </div>
        </div>
      </Section>

      <Section title="Button" description="Empat varian, tiga ukuran, state loading dan disabled.">
        <div className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Simpan</Button>
            <Button variant="secondary">Batal</Button>
            <Button variant="ghost">Lihat detail</Button>
            <Button variant="danger">Hapus</Button>
            <Button icon={<Plus size={16} strokeWidth={1.5} aria-hidden="true" />}>
              Tambah murid
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Kecil</Button>
            <Button size="md">Sedang</Button>
            <Button size="lg">Besar</Button>
            <Button loading>Menyimpan</Button>
            <Button disabled>Nonaktif</Button>
          </div>
        </div>
      </Section>

      <Section title="Field dan input" description="Default, fokus, error, disabled.">
        <div className="grid max-w-[640px] gap-4 rounded-md border border-border bg-surface p-6">
          <Field label="Nama lengkap" htmlFor="sg-name" required>
            <Input id="sg-name" placeholder="Nama lengkap murid" />
          </Field>
          <Field
            label="Username"
            htmlFor="sg-username"
            hint="Huruf kecil, angka, titik, atau garis bawah."
            error="Username sudah dipakai."
          >
            <Input id="sg-username" defaultValue="andi.wijaya" aria-invalid="true" />
          </Field>
          <Field label="Level HSK" htmlFor="sg-level">
            <Select id="sg-level" defaultValue="1">
              <option value="1">HSK 1</option>
              <option value="2">HSK 2</option>
            </Select>
          </Field>
          <Field label="Instruksi" htmlFor="sg-instruction">
            <Textarea id="sg-instruction" placeholder="Tulis instruksi tes" />
          </Field>
          <Field label="Dinonaktifkan" htmlFor="sg-disabled">
            <Input id="sg-disabled" disabled defaultValue="Tidak bisa diubah" />
          </Field>
        </div>
      </Section>

      <Section title="Badge" description="Status tes dan pengerjaan.">
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-6">
          <TestStatusBadge status="draft" />
          <TestStatusBadge status="open" />
          <TestStatusBadge status="closed" />
          <TestStatusBadge status="archived" />
          <AttemptStatusBadge status="in_progress" />
          <AttemptStatusBadge status="submitted" />
          <AttemptStatusBadge status="expired" />
          <Badge tone="primary">HSK 1</Badge>
        </div>
      </Section>

      <Section title="Alert">
        <div className="grid gap-3">
          <Alert tone="info" title="Informasi">
            Tes hanya dapat dikerjakan satu kali.
          </Alert>
          <Alert tone="success" title="Berhasil">
            Perubahan tes telah disimpan.
          </Alert>
          <Alert tone="warning" title="Perhatian">
            Waktu tersisa 5 menit.
          </Alert>
          <Alert tone="error" title="Gagal menyimpan">
            Periksa koneksi, lalu coba lagi.
          </Alert>
        </div>
      </Section>

      <Section title="Card dan StatCard">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Murid aktif" value={42} />
          <StatCard label="Tes terbuka" value={3} />
          <StatCard label="Sedang mengerjakan" value={7} />
          <StatCard label="Selesai hari ini" value={12} />
        </div>
        <Card title="Kartu contoh" description="Dengan judul dan deskripsi.">
          <p className="text-sm text-text">
            Isi kartu memakai latar surface, border 1px, dan radius 6px.
          </p>
        </Card>
      </Section>

      <Section title="Table" description="Data dummy, angka rata kanan.">
        <Table caption="Daftar murid contoh">
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Status</TableHead>
              <TableHead numeric>Jumlah tes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STUDENTS.map((student) => (
              <TableRow key={student.username}>
                <TableCell>{student.name}</TableCell>
                <TableCell className="font-mono text-xs">{student.username}</TableCell>
                <TableCell>{student.status}</TableCell>
                <TableCell numeric>{student.status === "Aktif" ? 3 : 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Empty state, skeleton, dialog, toast">
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            title="Belum ada tes"
            description="Buat tes pertama untuk mulai mengelola soal."
            action={<Button>Buat tes</Button>}
          />
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-6">
            <Skeleton className="h-5 w-1/3" />
            <SkeletonText lines={3} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setDialogOpen(true)}>Buka dialog konfirmasi</Button>
          <Button variant="secondary" onClick={() => toast("Perubahan disimpan.")}>
            Tampilkan toast sukses
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast("Gagal menyimpan. Periksa koneksi, lalu coba lagi.", "error")}
          >
            Tampilkan toast error
          </Button>
          <Button
            variant="secondary"
            loading={loading}
            onClick={() => {
              setLoading(true);
              window.setTimeout(() => setLoading(false), 1500);
            }}
          >
            Uji loading
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Hapus murid Andi Wijaya?"
          description="Riwayat hasil akan hilang dan murid harus dibuat ulang."
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button variant="danger" onClick={() => setDialogOpen(false)}>
                Hapus
              </Button>
            </>
          }
        >
          <p className="text-sm text-text">
            Tindakan ini tidak dapat dibatalkan. Pastikan murid tidak sedang
            mengerjakan tes.
          </p>
        </Dialog>
      </Section>
    </div>
  );
}

export function StyleguideClient() {
  return (
    <ToastProvider>
      <Demos />
    </ToastProvider>
  );
}
