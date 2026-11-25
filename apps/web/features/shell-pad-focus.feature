Feature: Moving among the shell's controls with a controller
  Scenario: Only the front window and the shell chrome are in reach
    Given these shell controller controls:
      """
      <button id="status"></button>
      <section class="window" data-window-id="1"><button>Covered</button></section>
      <section class="window focused" data-window-id="2">
        <button hidden></button><button disabled></button><input tabindex="-1"><button aria-disabled="true"></button>
        <details><summary id="more">More</summary><button>Folded</button></details>
        <details><button>No summary</button></details><iframe tabindex="0"></iframe>
        <button id="settings" role="tab" tabindex="-1">Settings</button>
      </section>
      """
    Then controller movements "next next activate next previous previous" focus "more settings settings status settings more"
    And the shell controller clicked only "settings"

  Scenario: The top question keeps focus and a stray confirm only highlights an answer
    Given these shell controller controls:
      """
      <section aria-modal="true" role="dialog"><button>Covered</button></section>
      <section aria-modal="true" role="dialog"><button id="deny"></button></section>
      """
    Then controller movements "activate previous next" focus "deny deny deny"
    And the shell controller did not click

  Scenario: An empty shell does not use an unreachable control
    Given these shell controller controls:
      """
      <button hidden></button>
      """
    Then controller movements "next" focus "nothing"

  Scenario: Confirm cycles a choice without opening a native popup or choosing a disabled option
    Given these shell controller controls:
      """
      <select id="choice"><option>First</option><optgroup disabled><option>Skip</option></optgroup><option disabled>Busy</option><option>Last</option></select>
      """
    Then controller movements "next activate" focus "choice choice"
    And the controller selection is option 3 after 1 change
    Then controller movements "activate" focus "choice"
    And the controller selection is option 0 after 2 changes

  Scenario: A select with no other available option is left alone
    Given these shell controller controls:
      """
      <select id="choice"><option>Only</option></select>
      """
    Then controller movements "next activate" focus "choice choice"
    And the controller selection is option 0 after 0 changes
