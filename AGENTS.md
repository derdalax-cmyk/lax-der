# Project architecture
- Guest signup prompts persist dismissal timestamps in localStorage for 24 hours, because they must remain non-blocking and avoid repeated visits.
