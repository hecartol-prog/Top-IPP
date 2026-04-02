import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, List, ListOrdered, Undo2, Redo2, Link, Image, Minus,
  Signature, ChevronDown
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const FONTS = ["Sans Serif", "Serif", "Monospace", "Arial", "Georgia", "Trebuchet MS", "Verdana", "Courier New"];
const FONT_SIZES = ["10", "12", "14", "16", "18", "20", "24", "28", "32", "36"];
const COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#ff0000", "#ff4500", "#ff9900", "#ffff00", "#00ff00", "#00ffff",
  "#0000ff", "#9900ff", "#ff00ff", "#e06666", "#f6b26b", "#ffd966",
  "#93c47d", "#76a5af", "#6fa8dc", "#8e7cc3", "#c27ba0",
];

const DEFAULT_SIGNATURE = `<br/><br/>--<br/><b>Best regards,</b><br/>Top Mold Team<br/><i style="color:#666">Plastic Injection Mold Manufacturing</i>`;

function ToolbarBtn({ onClick, title, active, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-slate-600 hover:bg-slate-100 ${active ? "bg-slate-200 text-slate-900" : ""}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5 shrink-0" />;
}

function FontDropdown({ label, options, onSelect, width = "w-32" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
        className={`flex items-center gap-1 px-2 h-7 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 ${width}`}
      >
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown className="w-3 h-3 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-48 overflow-y-auto min-w-[8rem]">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(opt); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
              style={opt !== "Sans Serif" && opt !== "Serif" && opt !== "Monospace" ? { fontFamily: opt } : {}}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorPicker({ icon, title, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
        title={title}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
      >
        {icon}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-2 w-36">
          <div className="grid grid-cols-6 gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onMouseDown={e => { e.preventDefault(); onSelect(c); setOpen(false); }}
                className="w-4 h-4 rounded border border-slate-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RichEmailEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const [currentFont, setCurrentFont] = useState("Sans Serif");
  const [currentSize, setCurrentSize] = useState("14");
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileRef = useRef();

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, []); // Only on mount

  const exec = useCallback((cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    syncValue();
  }, []);

  const syncValue = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleFontFamily = (font) => {
    setCurrentFont(font);
    const fontMap = {
      "Sans Serif": "Arial, sans-serif",
      "Serif": "Georgia, serif",
      "Monospace": "Courier New, monospace",
    };
    exec("fontName", fontMap[font] || font);
  };

  const handleFontSize = (size) => {
    setCurrentSize(size);
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      document.execCommand("fontSize", false, "7");
      const fontEls = editorRef.current.querySelectorAll('font[size="7"]');
      fontEls.forEach(el => {
        el.removeAttribute("size");
        el.style.fontSize = `${size}px`;
      });
    } else {
      // Apply to future typing via a span
      document.execCommand("insertHTML", false, `<span style="font-size:${size}px">&#8203;</span>`);
    }
    syncValue();
  };

  const handleInsertLink = () => {
    const url = window.prompt("Enter URL:", "https://");
    if (url) exec("createLink", url);
  };

  const handleInsertImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImg(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploadingImg(false);
    editorRef.current?.focus();
    document.execCommand("insertImage", false, file_url);
    syncValue();
    fileRef.current.value = "";
  };

  const handleInsertSignature = () => {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, DEFAULT_SIGNATURE);
    syncValue();
  };

  const handleInsertHR = () => {
    exec("insertHTML", "<hr style='border:none;border-top:1px solid #e2e8f0;margin:12px 0'/>");
  };

  const handlePaste = (e) => {
    // Allow HTML paste but clean up Word junk
    const html = e.clipboardData.getData("text/html");
    if (html) {
      e.preventDefault();
      const clean = html.replace(/<style[^>]*>.*?<\/style>/gis, "").replace(/class="[^"]*"/gi, "").replace(/mso-[^;]+;?/gi, "");
      document.execCommand("insertHTML", false, clean);
      syncValue();
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200 flex-wrap">
        {/* Undo / Redo */}
        <ToolbarBtn onClick={() => exec("undo")} title="Undo"><Undo2 className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("redo")} title="Redo"><Redo2 className="w-3.5 h-3.5" /></ToolbarBtn>
        <Divider />

        {/* Font family */}
        <FontDropdown
          label={currentFont}
          options={FONTS}
          onSelect={handleFontFamily}
          width="w-28"
        />

        {/* Font size */}
        <FontDropdown
          label={`${currentSize}px`}
          options={FONT_SIZES}
          onSelect={handleFontSize}
          width="w-16"
        />
        <Divider />

        {/* Bold / Italic / Underline / Strike */}
        <ToolbarBtn onClick={() => exec("bold")} title="Bold"><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("italic")} title="Italic"><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("underline")} title="Underline"><Underline className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("strikeThrough")} title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></ToolbarBtn>

        {/* Text color */}
        <ColorPicker
          title="Text Color"
          icon={<span className="text-xs font-bold" style={{ borderBottom: "2.5px solid #000" }}>A</span>}
          onSelect={(c) => exec("foreColor", c)}
        />
        <Divider />

        {/* Alignment */}
        <ToolbarBtn onClick={() => exec("justifyLeft")} title="Align Left"><AlignLeft className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("justifyCenter")} title="Center"><AlignCenter className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("justifyRight")} title="Align Right"><AlignRight className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("justifyFull")} title="Justify"><AlignJustify className="w-3.5 h-3.5" /></ToolbarBtn>
        <Divider />

        {/* Lists */}
        <ToolbarBtn onClick={() => exec("insertOrderedList")} title="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("insertUnorderedList")} title="Bullet List"><List className="w-3.5 h-3.5" /></ToolbarBtn>
        <Divider />

        {/* Link / Image / HR / Signature */}
        <ToolbarBtn onClick={handleInsertLink} title="Insert Link"><Link className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={() => fileRef.current.click()} title={uploadingImg ? "Uploading..." : "Insert Image"}>
          <Image className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={handleInsertHR} title="Insert Divider"><Minus className="w-3.5 h-3.5" /></ToolbarBtn>
        <ToolbarBtn onClick={handleInsertSignature} title="Insert Signature">
          <span className="text-[10px] font-semibold text-slate-500">Sig</span>
        </ToolbarBtn>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleInsertImage} />
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncValue}
        onPaste={handlePaste}
        data-placeholder={placeholder || "Email body... Use {{first_name}}, {{company_name}}, {{job_title}}"}
        className="min-h-[220px] max-h-[380px] overflow-y-auto p-3 text-sm text-slate-800 focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
        style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6" }}
      />
    </div>
  );
}