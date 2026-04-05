import json
import re

from fpdf import FPDF


class LaTeXRenderer(FPDF):
    """
    Lightweight LaTeX Interpreter for Pure Python (FPDF2).
    Draws professional A4 resumes from LaTeX source code.
    """

    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=15)
        self.set_font("helvetica", "", 9)

    def safe_text(self, text: str) -> str:
        """Filter out non-latin characters and fix dashes for basic Helvetica."""
        text = text.replace("\u2013", "-").replace("\u2014", "--").replace("\u00A0", " ")
        return "".join([c if ord(c) < 256 else "?" for c in text])

    def draw_latex(self, source: str):
        """Parse core LaTeX commands and draw them vertically."""
        body = source
        if "\\begin{document}" in source:
            body = source.split("\\begin{document}")[1].split("\\end{document}")[0]

        lines = body.split("\n")
        for line in lines:
            line = line.strip()
            if not line:
                self.ln(2)
                continue

            if "\\Huge" in line or (
                "\\textbf{" in line and "center" in source.lower() and lines.index(line.strip()) < 10
            ):
                name = re.sub(r"\\[a-zA-Z]+|\{|\}", "", line).strip()
                self.set_font("helvetica", "B", 20 if "\\Huge" in line else 16)
                self.cell(0, 10, self.safe_text(name), ln=True, align="C")
                continue

            if "\\section{" in line:
                title = line.split("\\section{")[1].split("}")[0]
                self.ln(5)
                self.set_font("helvetica", "B", 11)
                self.set_fill_color(245, 245, 245)
                self.cell(0, 7, self.safe_text(title.upper()), ln=True, fill=True)
                self.ln(2)
                continue

            if "\\item" in line:
                content = line.split("\\item")[1].strip()
                content = re.sub(r"\\textbf\{|\}", "", content)
                self.set_font("helvetica", "", 9)
                self.multi_cell(0, 4, f"• {self.safe_text(content)}")
                continue

            if "\\textbf{" in line:
                content = re.sub(r"\\textbf\{|\}", "", line).strip()
                self.set_font("helvetica", "B", 9)
                self.multi_cell(0, 4, self.safe_text(content))
                continue

            if line and not line.startswith("%") and not line.startswith("\\"):
                self.set_font("helvetica", "", 9)
                self.multi_cell(0, 4, self.safe_text(line))


def render_resume_pdf(latex_source: str) -> bytes:
    """Takes RAW LaTeX and returns professional PDF bytes via the Python Renderer."""
    pdf = LaTeXRenderer()
    pdf.add_page()
    pdf.draw_latex(latex_source)
    return bytes(pdf.output())
