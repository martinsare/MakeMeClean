import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Upload, X, Loader2, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Photo {
  id: string;
  storage_path: string;
  uploaded_at: string;
  signedUrl?: string;
}

export default function BookingPhotos() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(true);

  const fetchPhotos = async () => {
    if (!bookingId || !user) return;
    const { data, error: err } = await supabase
      .from("booking_photos")
      .select("id, storage_path, uploaded_at")
      .eq("booking_id", bookingId)
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false });

    if (!err && data) {
      const withUrls = await Promise.all(
        data.map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("booking-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, signedUrl: signed?.signedUrl ?? "" };
        })
      );
      setPhotos(withUrls);
    }
    setFetching(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setFetching(false);
      setLocation("/login");
      return;
    }
    fetchPhotos();
  }, [bookingId, user, authLoading, setLocation]);

  const uploadPhoto = async (file: File) => {
    if (!bookingId || !user) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `bookings/${bookingId}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("booking-photos")
        .upload(path, file, { upsert: false });

      if (uploadErr) throw new Error(uploadErr.message);

      const { error: dbErr } = await supabase.from("booking_photos").insert({
        booking_id: bookingId,
        user_id: user.id,
        storage_path: path,
      });

      if (dbErr) throw new Error(dbErr.message);

      setSuccess("Photo uploaded! Thank you for sharing.");
      await fetchPhotos();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError((e as Error).message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoId: string, path: string) => {
    if (!user) return;
    setDeleting(photoId);
    try {
      await supabase.storage.from("booking-photos").remove([path]);
      await supabase
        .from("booking_photos")
        .delete()
        .eq("id", photoId)
        .eq("user_id", user.id);
      await fetchPhotos();
    } catch (e) {
      setError((e as Error).message || "Failed to delete photo");
    } finally {
      setDeleting(null);
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Photos</h1>
          <p className="text-gray-600">Share photos of your clean home. Help us showcase our work and build trust with future customers.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          {success && (
            <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-800">{success}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <label className={cn(
            "flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-colors",
            uploading ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-green-300 hover:bg-green-50"
          )}>
            {uploading ? (
              <>
                <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-3" />
                <p className="text-sm font-semibold text-green-600">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                <p className="text-sm font-semibold text-gray-700">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG or WebP up to 5MB</p>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPhoto(file);
              }}
              className="hidden"
            />
          </label>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : photos.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No photos yet. Upload one to get started!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group bg-white rounded-2xl overflow-hidden shadow-sm">
                <img
                  src={photo.signedUrl || ""}
                  alt="Booking photo"
                  className="w-full h-48 object-cover bg-gray-100"
                />
                <button
                  onClick={() => deletePhoto(photo.id, photo.storage_path)}
                  disabled={deleting === photo.id}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {deleting === photo.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
