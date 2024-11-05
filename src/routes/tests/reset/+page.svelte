<div class="page">
	<div>
		<!-- Box Model Testing -->
		<section class="test-section" id="box-model">
			<h2>Box Model Testing</h2>
			<div style="width: 250px; padding: 1em; border: 5px solid var(--border);">
				This box should be exactly 250px wide including padding and border <code
					>(box-sizing: border-box)</code
				>
			</div>
		</section>

		<!-- Typography Testing -->
		<section class="test-section">
			<h1>Typography Testing</h1>
			<p>
				Regular paragraph. This is a long paragraph to test overflow-wrap: break-word.
				Supercalifragilisticexpialidocious pneumonoultramicroscopicsilicovolcanoconiosis.
			</p>
			<p>Another paragraph.</p>
			<h2>Heading 2</h2>
			<ul>
				<li>Unordered list item 1</li>
				<li>Unordered list item 2</li>
				<li>Unordered list item 3</li>
			</ul>
			<p>Following paragraph.</p>
			<ol>
				<li>Ordered list item 1</li>
				<li>Ordered list item 2</li>
				<li>Ordered list item 3</li>
			</ol>
			<h3>Heading 3</h3>
			<h4>Heading 4</h4>
			<h5>Heading 5</h5>
			<h6>Heading 6</h6>
		</section>

		<!-- Media Testing -->
		<section class="test-section">
			<img
				src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Everest_North_Face_toward_Base_Camp_Tibet_Luca_Galuzzi_2006.jpg/660px-Everest_North_Face_toward_Base_Camp_Tibet_Luca_Galuzzi_2006.jpg"
				alt="Mount Everest"
			/>
			<video controls>
				<source
					src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
					type="video/mp4"
				/>
				<track kind="captions" />
				Your browser does not support the video tag.
			</video>
			<svg width="100" height="100">
				<circle cx="50" cy="50" r="40" stroke="currentColor" stroke-width="4" fill="none" />
			</svg>
		</section>

		<!-- Form Elements Testing -->
		<section class="test-section">
			<form style="display: flex; flex-direction: column; gap: 0.5em">
				<fieldset>
					<label for="text-input">Text Input:</label>
					<input type="text" id="text-input" />
				</fieldset>

				<fieldset>
					<label for="search">Search Input:</label>
					<input type="search" id="search" />
				</fieldset>

				<fieldset>
					<label for="number">Number Input:</label>
					<input type="number" id="number" />
				</fieldset>

				<fieldset>
					<label for="textarea">Textarea (without rows):</label>
					<textarea id="textarea"></textarea>
				</fieldset>

				<fieldset>
					<label for="select">Select:</label>
					<select id="select">
						<option>Option 1</option>
						<option>Option 2</option>
					</select>
				</fieldset>

				<fieldset>
					<button type="button">Button</button>
					<input type="submit" value="Submit" />
					<input type="reset" value="Reset" />
				</fieldset>
			</form>
		</section>

		<!-- Text-level Semantics Testing -->
		<section class="test-section">
			<p>This is <strong>strong text</strong> and <b>bold text</b>.</p>
			<p>This is <em>emphasized text</em> and <i>italic text</i>.</p>
			<p>
				This is <code>code text</code>, <kbd>keyboard input</kbd>, and <samp>sample output</samp>.
			</p>
			<p>This is <small>small text</small>.</p>
			<p>Testing subscript H<sub>2</sub>O and superscript x<sup>2</sup>.</p>
		</section>

		<!-- Table Testing -->
		<section class="test-section">
			<table>
				<thead>
					<tr>
						<th>Header 1</th>
						<th>Header 2</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Cell 1</td>
						<td>Cell 2</td>
					</tr>
				</tbody>
			</table>
		</section>

		<!-- Interactive Elements Testing -->
		<section class="test-section">
			<details>
				<summary>Click to expand</summary>
				<p>Hidden content</p>
			</details>

			<progress value="70" max="100">70%</progress>
		</section>

		<!-- Focus Testing -->
		<section class="test-section">
			<p>Tab through these elements to test focus styles:</p>
			<a href="#box-model">Link to top</a>
			<button>Focusable Button</button>
			<input type="text" placeholder="Focusable Input" />
		</section>
	</div>

	<!-- Scroll Testing -->
	<div style="height: 1000px">Scroll space to test smooth scrolling and scroll-margin</div>
</div>

<style>
	.page {
		padding-inline: 2rem;
	}
</style>
