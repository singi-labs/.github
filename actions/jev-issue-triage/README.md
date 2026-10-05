# jev-issue-triage

Shared pre-step for the gh-aw `issue-triage` workflows. Asks Jev (TypeSafe
System One) the batched issue questions from `@singi-labs/sifa-sdk/jev/issue`
(type, stream, actionable, security, regression) and writes advisory label
suggestions to a JSON file plus a table in the step summary.

Shadow mode: the agent reports the suggestions next to its own labels and must
not adopt or drop a label because of them. Nothing here applies a label, and
the step never fails the job: a missing key, an API error, or a malformed
answer becomes `{ "ok": false, "reason": "..." }` and exit 0.

## Use in a gh-aw workflow

```yaml
steps:
  - uses: singi-labs/.github/actions/jev-issue-triage@main
    with:
      typesafe-api-key: ${{ secrets.TYPESAFE_API_KEY }}
```

Then add to the agent prompt:

```markdown
## 0. Jev pre-classification (shadow mode)

If `/tmp/gh-aw/jev-triage.json` exists, read it. It holds advisory label
suggestions from a typed classifier (Jev). Do your own triage first, then
compare. Do not apply a label only because Jev suggested it, and do not drop
one of yours because Jev disagrees. If the file is missing or has
`"ok": false`, skip this section.
```

and to the report template:

```markdown
### Jev pre-classification (shadow)
Suggested: [labels from `suggestions.labels`, or "none"]. Agreement: [full / partial / none], [one short reason].
```

## Inputs

| Input | Default | Notes |
|---|---|---|
| `typesafe-api-key` | required | repo secret `TYPESAFE_API_KEY`; held by the step only, never printed |
| `sdk-version` | `0.19.81` | exact `@singi-labs/sifa-sdk` version with `jev/issue` |
| `typesafe-sdk-version` | `0.6.0` | exact `@typesafe-ai/sdk` version |
| `model` | `jev-latest` | |
| `out-path` | `/tmp/gh-aw/jev-triage.json` | the gh-aw agent container mounts `/tmp/gh-aw` |

## Output

`out-path` JSON: `{ ok, mode: "shadow", issue, repo, model, usage, answers, suggestions: { labels, type, stream, needsInfo, security, regression }, thresholds }` or `{ ok: false, reason }`.

Thresholds and label names come from the SDK (`ISSUE_TYPE_CONFIDENCE_FLOOR` and friends); change them there, bump `sdk-version` here.
