import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Combobox,
    ComboboxInput,
    ComboboxOptions,
    ComboboxOption,
} from "@headlessui/react";
import { categories } from "../../data/categories";
import { useLanguage } from "../../hooks/useLanguage";
import { Button } from "../UI/Button";
import { SpinnerIcon } from "../UI/Icon";

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function uploadToCloudinary(file, signal) {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset)
        throw new Error("Cloudinary not configured");
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", uploadPreset);
    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
            method: "POST",
            body,
            signal,
        },
    );
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return data.secure_url;
}

function validate(data) {
    const e = {};
    if (!data.category) e.category = "categoryRequired";
    if (!data.businessName.trim()) e.businessName = "businessNameRequired";
    else if (data.businessName.length > 100) e.businessName = "businessNameTooLong";
    if (!data.descriptionEn.trim()) e.descriptionEn = "descriptionEnRequired";
    else if (data.descriptionEn.length > 600) e.descriptionEn = "descriptionTooLong";
    if (!data.descriptionUa.trim()) e.descriptionUa = "descriptionUaRequired";
    else if (data.descriptionUa.length > 600) e.descriptionUa = "descriptionTooLong";
    if (data.phone.trim() && !/^[\d\s+\-()]+$/.test(data.phone.trim()))
        e.phone = "phoneInvalid";
    if (!data.email.trim()) e.email = "emailRequired";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))
        e.email = "emailInvalid";
    if (data.website && !/^https?:\/\//i.test(data.website))
        e.website = "websiteInvalid";
    if (data.instagram && !/instagram\.com\//i.test(data.instagram))
        e.instagram = "instagramInvalid";
    if (data.facebook && !/facebook\.com\//i.test(data.facebook))
        e.facebook = "facebookInvalid";
    if (data.linkedin && !/linkedin\.com\//i.test(data.linkedin))
        e.linkedin = "linkedinInvalid";
    if (!data.consent) e.consent = "consentRequired";
    return e;
}

function normalizeUrl(value, field) {
    const v = value.trim();
    if (!v) return v;
    if (/^https?:\/\//i.test(v)) return v;
    if (field === "website") return v.includes(".") ? `https://${v}` : v;
    if (field === "instagram") {
        if (v.startsWith("@")) return `https://instagram.com/${v.slice(1)}`;
        if (/instagram\.com/i.test(v)) return `https://${v}`;
        return `https://instagram.com/${v}`;
    }
    if (field === "facebook") {
        if (v.startsWith("@")) return `https://facebook.com/${v.slice(1)}`;
        if (/facebook\.com/i.test(v)) return `https://${v}`;
        return `https://facebook.com/${v}`;
    }
    if (field === "linkedin") {
        if (v.startsWith("@")) return `https://linkedin.com/in/${v.slice(1)}`;
        if (/linkedin\.com/i.test(v)) return `https://${v}`;
        return `https://linkedin.com/in/${v}`;
    }
    return v;
}

function FormField({ label, hint, error, required, children, htmlFor }) {
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={htmlFor} className="text-sm font-bold text-dark-blue">
                {label}
                {required && <span className="text-brand-red ml-1">*</span>}
            </label>
            {children}
            {error ? (
                <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-xs text-brand-red">{error}</p>
            ) : hint ? (
                <p className="text-xs text-text/50">{hint}</p>
            ) : null}
        </div>
    );
}

const INITIAL = {
    category: "",
    businessName: "",
    descriptionEn: "",
    descriptionUa: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    instagram: "",
    facebook: "",
    linkedin: "",
    consent: false,
    honeypot: "",
};

export function AddServiceForm() {
    const { t } = useLanguage();
    const [formData, setFormData] = useState(INITIAL);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [status, setStatus] = useState("idle");
    const [query, setQuery] = useState("");
    const [images, setImages] = useState([]);
    const optionsRef = useRef(null);
    const imagesRef = useRef([]);
    const wasSubmittedRef = useRef(false);
    const removedIdsRef = useRef(new Set());
    const pageUnloadingRef = useRef(false);
    const isUnmountingRef = useRef(false);
    const uploadControllersRef = useRef({});
    const [isDragging, setIsDragging] = useState(false);
    const [imageError, setImageError] = useState("");
    const fileInputRef = useRef(null);
    const dragCountRef = useRef(0);
    const [draggingId, setDraggingId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);

    useEffect(() => {
        imagesRef.current = images;
    }, [images]);

    useEffect(() => {
        isUnmountingRef.current = false;

        const handleBeforeUnload = () => {
            if (wasSubmittedRef.current) return;
            pageUnloadingRef.current = true;
            isUnmountingRef.current = true;
            Object.values(uploadControllersRef.current).forEach((c) =>
                c.abort(),
            );
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            if (wasSubmittedRef.current || pageUnloadingRef.current) return;
            isUnmountingRef.current = true;
            Object.values(uploadControllersRef.current).forEach((c) =>
                c.abort(),
            );
        };
    }, []);

    const processFiles = (files) => {
        setImageError("");
        const remaining = MAX_IMAGES - images.length;
        let hasOversized = false;
        Array.from(files)
            .slice(0, remaining)
            .forEach((file) => {
                if (file.size > MAX_FILE_SIZE) {
                    hasOversized = true;
                    return;
                }
                const id = Math.random().toString(36).slice(2);
                const previewUrl = URL.createObjectURL(file);
                const controller = new AbortController();
                uploadControllersRef.current[id] = controller;
                setImages((prev) => [
                    ...prev,
                    { id, previewUrl, cloudUrl: null, status: "uploading" },
                ]);
                uploadToCloudinary(file, controller.signal)
                    .then((cloudUrl) => {
                        delete uploadControllersRef.current[id];
                        if (
                            removedIdsRef.current.has(id) ||
                            isUnmountingRef.current
                        ) {
                            return;
                        } else {
                            setImages((prev) =>
                                prev.map((img) =>
                                    img.id === id
                                        ? { ...img, cloudUrl, status: "done" }
                                        : img,
                                ),
                            );
                        }
                    })
                    .catch((err) => {
                        delete uploadControllersRef.current[id];
                        if (err.name === "AbortError") return;
                        setImages((prev) =>
                            prev.map((img) =>
                                img.id === id
                                    ? { ...img, status: "error" }
                                    : img,
                            ),
                        );
                    });
            });
        if (hasOversized) setImageError(t("addService.errors.imageTooLarge"));
    };

    const handleImageSelect = (e) => {
        processFiles(e.target.files);
        e.target.value = "";
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        if (!e.dataTransfer.types.includes("Files")) return;
        dragCountRef.current++;
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        dragCountRef.current--;
        if (dragCountRef.current === 0) setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        dragCountRef.current = 0;
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith("image/"),
        );
        if (files.length > 0) processFiles(files);
    };

    const retryImage = (id) => {
        const img = images.find((i) => i.id === id);
        if (!img) return;
        setImages((prev) =>
            prev.map((i) => (i.id === id ? { ...i, status: "uploading" } : i)),
        );
        fetch(img.previewUrl)
            .then((r) => r.blob())
            .then((blob) => uploadToCloudinary(new File([blob], "image")))
            .then((cloudUrl) => {
                if (removedIdsRef.current.has(id)) {
                    return;
                } else {
                    setImages((prev) =>
                        prev.map((i) =>
                            i.id === id
                                ? { ...i, cloudUrl, status: "done" }
                                : i,
                        ),
                    );
                }
            })
            .catch(() =>
                setImages((prev) =>
                    prev.map((i) =>
                        i.id === id ? { ...i, status: "error" } : i,
                    ),
                ),
            );
    };

    const removeImage = (id) => {
        removedIdsRef.current.add(id);
        const img = images.find((i) => i.id === id);
        if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
        setImages((prev) => prev.filter((i) => i.id !== id));
    };

    const handleImageDragStart = (e, id) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        setDraggingId(id);
    };

    const handleImageDragOver = (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (id !== draggingId) setDragOverId(id);
    };

    const handleImageDrop = (e, targetId) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggingId || draggingId === targetId) {
            setDraggingId(null);
            setDragOverId(null);
            return;
        }
        setImages((prev) => {
            const from = prev.findIndex((i) => i.id === draggingId);
            const to = prev.findIndex((i) => i.id === targetId);
            const next = [...prev];
            next.splice(to, 0, next.splice(from, 1)[0]);
            return next;
        });
        setDraggingId(null);
        setDragOverId(null);
    };

    const handleImageDragEnd = () => {
        setDraggingId(null);
        setDragOverId(null);
    };

    const inputClass = (hasError) =>
        `w-full rounded-xl border ${hasError ? "border-brand-red" : "border-stroke"} bg-white dark:bg-[#0A1628] text-text px-4 py-3 text-base focus:outline-none focus:border-brand-blue placeholder:text-text/40 transition-colors`;

    const handleChange = (field, value) => {
        if (status === "error") setStatus("idle");
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (touched[field]) {
            const err = validate({ ...formData, [field]: value })[field];
            setErrors((prev) => ({ ...prev, [field]: err }));
        }
    };

    const handleBlur = (field) => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        const err = validate(formData)[field];
        setErrors((prev) => ({ ...prev, [field]: err }));
    };

    const handleSocialBlur = (field) => {
        const normalized = normalizeUrl(formData[field], field);
        const newFormData = { ...formData, [field]: normalized };
        setFormData(newFormData);
        setTouched((prev) => ({ ...prev, [field]: true }));
        const err = validate(newFormData)[field];
        setErrors((prev) => ({ ...prev, [field]: err }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const allErrors = validate(formData);
        setErrors(allErrors);
        setTouched(
            Object.fromEntries(Object.keys(INITIAL).map((k) => [k, true])),
        );
        if (Object.keys(allErrors).length > 0) {
            const firstKey = Object.keys(allErrors)[0];
            document.getElementById(firstKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        setStatus("submitting");
        try {
            const res = await fetch("/api/submit-service", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    imageUrls: images
                        .filter((i) => i.status === "done")
                        .map((i) => i.cloudUrl),
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                wasSubmittedRef.current = true;
                setStatus("success");
                setFormData(INITIAL);
                setErrors({});
                setTouched({});
                setQuery("");
                setImages([]);
            } else {
                setStatus("error");
            }
        } catch {
            setStatus("error");
        }
    };

    const grouped = categories
        .map((cat) => ({
            name: cat.name,
            icon: cat.icon,
            subs: cat.subcategories.filter(
                (sub) =>
                    query === "" ||
                    sub.toLowerCase().includes(query.toLowerCase()) ||
                    t(`subcategories.${sub}`)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
            ),
        }))
        .filter((cat) => cat.subs.length > 0);

    if (status === "success") {
        return (
            <div className="text-center py-8 flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg
                        className="w-10 h-10 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>
                <div className="flex flex-col gap-2">
                    <p className="text-2xl font-bold text-dark-blue">
                        {t("addService.successTitle")}
                    </p>
                    <p className="text-text/60 text-base max-w-sm mx-auto">
                        {t("addService.success")}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <Button
                        type="button"
                        onClick={() => {
                            wasSubmittedRef.current = false;
                            setStatus("idle");
                        }}
                    >
                        {t("addService.submitAnother")}
                    </Button>
                    <Link
                        to="/"
                        className="text-brand-blue hover:underline text-base"
                    >
                        {t("addService.backHome")}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            noValidate
            className="flex flex-col gap-6"
        >
            {/* Honeypot */}
            <div
                style={{
                    position: "absolute",
                    left: "-9999px",
                    top: "-9999px",
                }}
                aria-hidden="true"
            >
                <input
                    type="text"
                    name="url_confirm"
                    value={formData.honeypot}
                    onChange={(e) =>
                        setFormData((prev) => ({
                            ...prev,
                            honeypot: e.target.value,
                        }))
                    }
                    tabIndex={-1}
                    autoComplete="off"
                />
            </div>

            {/* Category */}
            <FormField
                label={t("addService.fields.category")}
                required
                htmlFor="category"
                error={
                    touched.category && errors.category
                        ? t(`addService.errors.${errors.category}`)
                        : undefined
                }
            >
                <div className="relative">
                    <Combobox
                        immediate
                        value={formData.category}
                        onChange={(val) => {
                            handleChange("category", val || "");
                            setQuery("");
                        }}
                    >
                        <ComboboxInput
                            id="category"
                            aria-describedby="category-error"
                            aria-invalid={!!(touched.category && errors.category)}
                            className={inputClass(
                                touched.category && errors.category,
                            )}
                            onChange={(e) => setQuery(e.target.value)}
                            onBlur={() => handleBlur("category")}
                            onFocus={() =>
                                requestAnimationFrame(() => {
                                    if (optionsRef.current)
                                        optionsRef.current.scrollTop = 0;
                                })
                            }
                            displayValue={(val) =>
                                val ? t(`subcategories.${val}`) : ""
                            }
                            placeholder={t(
                                "addService.fields.categoryPlaceholder",
                            )}
                        />
                        <ComboboxOptions
                            ref={optionsRef}
                            className="absolute z-10 w-full mt-1 bg-white dark:bg-[#0F2040] border border-stroke rounded-2xl shadow-card overflow-y-auto max-h-64"
                        >
                            {grouped.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-text/50">
                                    {t("addService.noResults")}
                                </div>
                            ) : (
                                grouped.map((cat) => (
                                    <div key={cat.name}>
                                        <div className="text-xs font-bold text-text/50 uppercase px-3 pt-3 pb-1 select-none">
                                            {cat.icon}{" "}
                                            {t(`categories.${cat.name}`)}
                                        </div>
                                        {cat.subs.map((sub) => (
                                            <ComboboxOption
                                                key={sub}
                                                value={sub}
                                                className="px-3 py-2 text-base text-text cursor-pointer data-focus:bg-light-gray dark:data-focus:bg-[#1E3A5F] data-focus:text-dark-blue"
                                            >
                                                {t(`subcategories.${sub}`)}
                                            </ComboboxOption>
                                        ))}
                                    </div>
                                ))
                            )}
                        </ComboboxOptions>
                    </Combobox>
                </div>
            </FormField>

            {/* Business name */}
            <FormField
                label={t("addService.fields.businessName")}
                required
                htmlFor="businessName"
                error={
                    touched.businessName && errors.businessName
                        ? t(`addService.errors.${errors.businessName}`)
                        : undefined
                }
            >
                <input
                    id="businessName"
                    type="text"
                    maxLength={100}
                    aria-describedby="businessName-error"
                    aria-invalid={!!(touched.businessName && errors.businessName)}
                    value={formData.businessName}
                    onChange={(e) =>
                        handleChange("businessName", e.target.value)
                    }
                    onBlur={() => handleBlur("businessName")}
                    className={inputClass(
                        touched.businessName && errors.businessName,
                    )}
                    autoComplete="organization"
                />
                <p className={`text-xs text-right mt-1 ${formData.businessName.length >= 90 ? "text-brand-red" : "text-text/50"}`}>
                    {formData.businessName.length}/100
                </p>
            </FormField>

            {/* Description EN */}
            <FormField
                label={t("addService.fields.descriptionEn")}
                required
                htmlFor="descriptionEn"
                hint={t("addService.fields.descriptionEnHint")}
                error={
                    touched.descriptionEn && errors.descriptionEn
                        ? t(`addService.errors.${errors.descriptionEn}`)
                        : undefined
                }
            >
                <textarea
                    id="descriptionEn"
                    rows={4}
                    maxLength={600}
                    aria-describedby="descriptionEn-error"
                    aria-invalid={!!(touched.descriptionEn && errors.descriptionEn)}
                    value={formData.descriptionEn}
                    onChange={(e) =>
                        handleChange("descriptionEn", e.target.value)
                    }
                    onBlur={() => handleBlur("descriptionEn")}
                    className={`${inputClass(touched.descriptionEn && errors.descriptionEn)} resize-none`}
                />
                <p className={`text-xs text-right mt-1 ${formData.descriptionEn.length >= 550 ? "text-brand-red" : "text-text/50"}`}>
                    {formData.descriptionEn.length}/600
                </p>
            </FormField>

            {/* Description UA */}
            <FormField
                label={t("addService.fields.descriptionUa")}
                required
                htmlFor="descriptionUa"
                hint={t("addService.fields.descriptionUaHint")}
                error={
                    touched.descriptionUa && errors.descriptionUa
                        ? t(`addService.errors.${errors.descriptionUa}`)
                        : undefined
                }
            >
                <textarea
                    id="descriptionUa"
                    rows={4}
                    maxLength={600}
                    aria-describedby="descriptionUa-error"
                    aria-invalid={!!(touched.descriptionUa && errors.descriptionUa)}
                    value={formData.descriptionUa}
                    onChange={(e) =>
                        handleChange("descriptionUa", e.target.value)
                    }
                    onBlur={() => handleBlur("descriptionUa")}
                    className={`${inputClass(touched.descriptionUa && errors.descriptionUa)} resize-none`}
                />
                <p className={`text-xs text-right mt-1 ${formData.descriptionUa.length >= 550 ? "text-brand-red" : "text-text/50"}`}>
                    {formData.descriptionUa.length}/600
                </p>
            </FormField>

            {/* Phone */}
            <FormField
                label={t("addService.fields.phone")}
                htmlFor="phone"
                error={
                    touched.phone && errors.phone
                        ? t(`addService.errors.${errors.phone}`)
                        : undefined
                }
            >
                <input
                    id="phone"
                    type="tel"
                    aria-describedby="phone-error"
                    aria-invalid={!!(touched.phone && errors.phone)}
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    onBlur={() => handleBlur("phone")}
                    className={inputClass(touched.phone && errors.phone)}
                    autoComplete="tel"
                />
            </FormField>

            {/* Email */}
            <FormField
                label={t("addService.fields.email")}
                required
                htmlFor="email"
                error={
                    touched.email && errors.email
                        ? t(`addService.errors.${errors.email}`)
                        : undefined
                }
            >
                <input
                    id="email"
                    type="email"
                    aria-describedby="email-error"
                    aria-invalid={!!(touched.email && errors.email)}
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    className={inputClass(touched.email && errors.email)}
                    autoComplete="email"
                />
            </FormField>

            {/* Optional section */}
            <div className="border-t border-stroke pt-6 flex flex-col gap-6">
                <p className="text-sm font-bold text-text/50 uppercase tracking-wide">
                    {t("addService.optionalSection")}
                </p>

                {/* Address */}
                <FormField
                    label={t("addService.fields.address")}
                    hint={t("addService.fields.addressHint")}
                    htmlFor="address"
                >
                    <input
                        id="address"
                        type="text"
                        value={formData.address}
                        onChange={(e) =>
                            handleChange("address", e.target.value)
                        }
                        className={inputClass(false)}
                        autoComplete="street-address"
                    />
                </FormField>

                {/* Website */}
                <FormField
                    label={t("addService.fields.website")}
                    hint={t("addService.fields.websiteHint")}
                    htmlFor="website"
                    error={
                        touched.website && errors.website
                            ? t(`addService.errors.${errors.website}`)
                            : undefined
                    }
                >
                    <input
                        id="website"
                        type="url"
                        aria-describedby="website-error"
                        aria-invalid={!!(touched.website && errors.website)}
                        value={formData.website}
                        onChange={(e) =>
                            handleChange("website", e.target.value)
                        }
                        onBlur={() => handleSocialBlur("website")}
                        className={inputClass(
                            touched.website && errors.website,
                        )}
                        autoComplete="url"
                    />
                </FormField>

                {/* Instagram */}
                <FormField
                    label={t("addService.fields.instagram")}
                    hint={t("addService.fields.instagramHint")}
                    htmlFor="instagram"
                    error={
                        touched.instagram && errors.instagram
                            ? t(`addService.errors.${errors.instagram}`)
                            : undefined
                    }
                >
                    <input
                        id="instagram"
                        type="url"
                        aria-describedby="instagram-error"
                        aria-invalid={!!(touched.instagram && errors.instagram)}
                        value={formData.instagram}
                        onChange={(e) =>
                            handleChange("instagram", e.target.value)
                        }
                        onBlur={() => handleSocialBlur("instagram")}
                        className={inputClass(
                            touched.instagram && errors.instagram,
                        )}
                    />
                </FormField>

                {/* Facebook */}
                <FormField
                    label={t("addService.fields.facebook")}
                    hint={t("addService.fields.facebookHint")}
                    htmlFor="facebook"
                    error={
                        touched.facebook && errors.facebook
                            ? t(`addService.errors.${errors.facebook}`)
                            : undefined
                    }
                >
                    <input
                        id="facebook"
                        type="url"
                        aria-describedby="facebook-error"
                        aria-invalid={!!(touched.facebook && errors.facebook)}
                        value={formData.facebook}
                        onChange={(e) =>
                            handleChange("facebook", e.target.value)
                        }
                        onBlur={() => handleSocialBlur("facebook")}
                        className={inputClass(
                            touched.facebook && errors.facebook,
                        )}
                    />
                </FormField>

                {/* LinkedIn */}
                <FormField
                    label={t("addService.fields.linkedin")}
                    hint={t("addService.fields.linkedinHint")}
                    htmlFor="linkedin"
                    error={
                        touched.linkedin && errors.linkedin
                            ? t(`addService.errors.${errors.linkedin}`)
                            : undefined
                    }
                >
                    <input
                        id="linkedin"
                        type="url"
                        aria-describedby="linkedin-error"
                        aria-invalid={!!(touched.linkedin && errors.linkedin)}
                        value={formData.linkedin}
                        onChange={(e) =>
                            handleChange("linkedin", e.target.value)
                        }
                        onBlur={() => handleSocialBlur("linkedin")}
                        className={inputClass(
                            touched.linkedin && errors.linkedin,
                        )}
                    />
                </FormField>

                {/* Images */}
                <FormField
                    label={t("addService.fields.images")}
                    hint={!imageError ? (images.length >= 2 ? t("addService.fields.imagesReorderHint") : t("addService.fields.imagesHint")) : undefined}
                    error={imageError || undefined}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                    />
                    {images.length === 0 ? (
                        <div
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors select-none ${
                                isDragging
                                    ? "border-brand-blue bg-brand-blue/5 dark:bg-brand-blue/10"
                                    : "border-stroke hover:border-brand-blue/50"
                            }`}
                        >
                            <svg
                                className="w-8 h-8 text-text/30"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                                />
                            </svg>
                            <p className="text-sm text-text/50 text-center">
                                {t("addService.fields.imagesDrop")}
                            </p>
                        </div>
                    ) : (
                        <div
                            className="flex flex-wrap gap-2"
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            {images.map((img, index) => (
                                <div
                                    key={img.id}
                                    draggable
                                    onDragStart={(e) => handleImageDragStart(e, img.id)}
                                    onDragOver={(e) => handleImageDragOver(e, img.id)}
                                    onDrop={(e) => handleImageDrop(e, img.id)}
                                    onDragEnd={handleImageDragEnd}
                                    className={`relative w-20 h-20 cursor-grab active:cursor-grabbing select-none transition-opacity ${draggingId === img.id ? "opacity-40" : ""} ${dragOverId === img.id ? "ring-2 ring-brand-blue rounded-xl" : ""}`}
                                >
                                    <img
                                        src={img.previewUrl}
                                        alt=""
                                        className="w-full h-full object-cover rounded-xl"
                                    />
                                    {index === 0 && images.length > 1 && (
                                        <span className="absolute bottom-0 left-0 right-0 rounded-b-xl bg-black/60 text-white text-[10px] text-center py-0.5 leading-tight pointer-events-none">
                                            {t("addService.coverLabel")}
                                        </span>
                                    )}
                                    {img.status === "uploading" && (
                                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                                            <SpinnerIcon className="w-5 h-5 text-white animate-spin" />
                                        </div>
                                    )}
                                    {img.status === "error" && (
                                        <button
                                            type="button"
                                            onClick={() => retryImage(img.id)}
                                            className="absolute inset-0 bg-brand-red/70 rounded-xl flex items-center justify-center text-white text-xs text-center px-1"
                                        >
                                            {t(
                                                "addService.errors.imageUploadFailed",
                                            )}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeImage(img.id)}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white dark:bg-[#0F2040] rounded-full border border-stroke text-text flex items-center justify-center text-xs leading-none"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            {images.length < MAX_IMAGES && (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`w-20 h-20 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-colors select-none ${
                                        isDragging
                                            ? "border-brand-blue bg-brand-blue/5 dark:bg-brand-blue/10"
                                            : "border-stroke hover:border-brand-blue/50"
                                    }`}
                                >
                                    <span className="text-2xl text-text/40 leading-none pb-0.5">
                                        +
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </FormField>
            </div>

            {/* Consent */}
            <div className="flex flex-col gap-1">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        aria-describedby="consent-error"
                        aria-invalid={!!(touched.consent && errors.consent)}
                        checked={formData.consent}
                        onChange={(e) =>
                            handleChange("consent", e.target.checked)
                        }
                        onBlur={() => handleBlur("consent")}
                        className="mt-0.5 w-4 h-4 accent-brand-red shrink-0"
                    />
                    <span className="text-sm text-text">
                        {t("addService.consent")}{" "}
                        <Link
                            to="/privacy"
                            className="text-brand-blue hover:underline"
                        >
                            {t("addService.consentLink")}
                        </Link>
                    </span>
                </label>
                {touched.consent && errors.consent && (
                    <p id="consent-error" role="alert" className="text-xs text-brand-red">
                        {t(`addService.errors.${errors.consent}`)}
                    </p>
                )}
            </div>

            {/* Submit */}
            <div className="flex flex-col gap-3">
                <Button
                    type="submit"
                    disabled={
                        status === "submitting" ||
                        images.some((i) => i.status === "uploading")
                    }
                    className="w-full md:w-auto md:self-start"
                >
                    {status === "submitting" ? (
                        <span className="flex items-center gap-2">
                            <SpinnerIcon className="w-5 h-5 animate-spin" />
                            {t("addService.submitting")}
                        </span>
                    ) : (
                        t("addService.submit")
                    )}
                </Button>
                {images.some((i) => i.status === "uploading") && (
                    <p className="text-xs text-text/50">
                        {t("addService.waitForImages")}
                    </p>
                )}
                {status === "error" && (
                    <p className="text-sm text-brand-red">
                        {t("addService.error")}
                    </p>
                )}
            </div>
        </form>
    );
}
