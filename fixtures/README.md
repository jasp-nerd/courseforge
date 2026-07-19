# Test fixtures

Real Common Cartridge exports used for parser, validator, and round-trip tests.

Sourced from the test corpus of [commonsyllabi/commoncartridge](https://github.com/commonsyllabi/commoncartridge) (MIT-licensed parser project), which collected public course exports from Canvas, Moodle, Blackboard, Brightspace, and Sakai. A curated subset is vendored here to keep the repo small:

| File | Origin / notes |
|---|---|
| `canvas-summer-template-export.imscc` | Full Canvas export with modules, pages, assignments, quizzes, discussions — the primary golden reference for Canvas-flavored cartridges |
| `sample-public-sandbox-course-export.imscc` | Small Canvas sandbox export |
| `py4e_export.imscc` | "Python for Everybody" open course export |
| `intro_chem.imscc` | OER chemistry course |
| `approaches_to_lit.imscc` | Small literature course |
| `offline_content_module_live80.v1321.imscc` | Minimal module-focused export |
| `single-page.imscc` | Smallest valid cartridge (one page) |
| `ThinCC_SU21_...imscc` | "Thin CC" variant (links only) |

These are content-only course exports (no student data). Do not add fixtures containing personal data.
