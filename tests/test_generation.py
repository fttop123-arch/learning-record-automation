"""원본 샘플을 읽고 메모리에서 검증한다. Excel 파일은 저장하지 않는다."""
import hashlib
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from generate_excel import ask_choice, build_excel, validate_ready, verify_excel
from load_reference import load_reference
from parse_attendees import parse_attendees
from parse_notice import parse_notice


class GenerationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = next(ROOT.glob("*작업용.xlsx"))
        cls.notice = parse_notice(next(ROOT.glob("*.pdf")))
        cls.roster = parse_attendees(next(ROOT.glob("*명단.xlsx")))
        cls.reference = load_reference(cls.template, cls.notice["type_raw"])

    def test_generated_values_and_preservation(self):
        inputs = list(ROOT.glob("*.xlsx")) + list(ROOT.glob("*.pdf"))
        hashes = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
        self.assertEqual([a["name"] for a in self.roster["attendees"]], ["김지현", "문형식"])
        for required, participation in (("N", "0"), ("Y", "1")):
            with self.subTest(required=required, participation=participation):
                payload = build_excel(self.template, self.notice, self.roster["attendees"],
                                      self.reference["official"], required, "N", participation)
                verify_excel(self.template, payload, self.notice, self.roster["attendees"],
                             self.reference["official"], required, participation)
        self.assertEqual(hashes, {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs})

    def test_welfare_yes_requires_more_confirmation(self):
        with self.assertRaisesRegex(ValueError, "추가 확인 필요"):
            build_excel(self.template, self.notice, self.roster["attendees"],
                        self.reference["official"], "N", "Y", "0")

    def test_invalid_input_and_defaults(self):
        with patch("builtins.input", side_effect=["잘못된 값", ""]):
            self.assertEqual(ask_choice("필수교육", ("N", "Y"), "N"), "N")
        with patch("builtins.input", side_effect=["", "9", "0"]):
            self.assertEqual(ask_choice("참여유형", ("0", "1")), "0")

    def test_unresolved_attendee_blocks_generation(self):
        with self.assertRaisesRegex(ValueError, "동명이인"):
            validate_ready({"attendees": [{"status": "동명이인 확인 필요"}]}, self.reference, 1)
        with self.assertRaises(ValueError):
            validate_ready({"attendees": []}, self.reference, 1)
        with self.assertRaises(ValueError):
            validate_ready(self.roster, {"official": None}, 1)


if __name__ == "__main__":
    unittest.main()
